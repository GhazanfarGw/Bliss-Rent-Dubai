-- =============================================================================
-- Phase 7 — Late-extension penalty: admin-configurable (not hard-coded),
-- historical rate preserved, and changes audited (2026-08-29, follow-up to
-- 20260905000000_phase7_pricing_decisions_confirmed.sql)
--
-- NOT YET APPLIED TO PRODUCTION. Written and tested locally only.
--
-- Clarification from the owner: the 10% late-extension penalty confirmed in
-- 20260905000000 is the INITIAL value, not a permanent hard-coded one. It
-- already wasn't hard-coded in code — computeExtensionPenalty()
-- (src/lib/extensionPenalty.ts) has always read percentageRate from
-- extension_penalty_settings, never from a literal in the function body —
-- so an owner changing Settings → Extension Penalty → Percentage from 10 to
-- 15 already takes effect for every NEW extension with zero code deployment.
-- What this migration adds is the two things that actually WERE missing:
--
--   1. HISTORICAL INTEGRITY: booking_extensions already stores the
--      computed penalty_amount (an absolute AED value, never recomputed
--      from current settings when displayed later) and penalty_policy_used
--      (which formula), so an old extension's charged amount was already
--      safe from a later settings change. What was missing is the RAW
--      configured value itself (e.g. "10" for a percentage policy, or a
--      fixed-fee/per-day amount) — needed so a human looking at extension
--      #123 six months from now can see "10% applied" even after the
--      owner has since changed the live setting to 15%, rather than only
--      seeing a bare AED figure with no rate to explain it. New column:
--      booking_extensions.penalty_rate_used.
--
--   2. AUDIT TRAIL: updateExtensionPenaltySettings()/
--      updateExtensionPricingSettings() (adminExtensionsApi.ts) already go
--      through RLS restricted to is_super_admin() — a staff account
--      already cannot change either setting, full stop — but neither
--      change was ever recorded anywhere. Reuses the EXACT existing
--      audit_logs architecture and trigger pattern this project already
--      established for vehicles/pricing/complaints (audit_vehicle_change/
--      audit_pricing_change/audit_complaint_status_change in
--      20260827000000_phase3_admin_dashboard.sql) — no new/duplicate audit
--      system. Covers BOTH settings tables for consistency (pricing policy
--      is exactly the same class of owner-controlled global setting as
--      the penalty policy, and was equally unaudited before this).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. booking_extensions.penalty_rate_used — the raw configured value in
--    effect at processing time (percentage_rate / per_day_amount /
--    fixed_fee_amount depending on penalty_policy_used), alongside the
--    already-existing penalty_amount (the computed AED figure) and
--    penalty_policy_used (which formula). All three are set once, at
--    processing time, and never recomputed — the same "computed and
--    frozen, not re-derived from live settings" guarantee penalty_amount
--    already had.
-- ---------------------------------------------------------------------------
alter table booking_extensions
  add column penalty_rate_used numeric check (penalty_rate_used is null or penalty_rate_used >= 0);

comment on column booking_extensions.penalty_rate_used is
  'The raw configured penalty value in effect when this extension was processed — the percentage rate, per-day amount, or fixed fee (matching penalty_policy_used), NOT the computed AED amount (see penalty_amount). Frozen at processing time so a later change to extension_penalty_settings can never alter what an already-processed extension is shown to have used. Example: policy=percentage, penalty_rate_used=10 means "10% was applied", independent of whatever percentage extension_penalty_settings.percentage_rate holds today.';

-- ---------------------------------------------------------------------------
-- 2. request_booking_extension — replaces the Phase 7 (booking
--    reassignment) version, adding p_penalty_rate_used (trailing, default
--    null, so this is backward-compatible with any in-flight caller that
--    hasn't been updated yet). Everything else about the function is
--    UNCHANGED — same validation, same conflict/reassignment handling,
--    same two-entry-point design.
-- ---------------------------------------------------------------------------
drop function if exists request_booking_extension(uuid, date, text, text, text, numeric, text, extension_pricing_policy, uuid, numeric, text);

create or replace function request_booking_extension(
  p_booking_id                uuid,
  p_requested_return_date     date,
  p_support_confirmed_by      text,
  p_support_confirmation_note text,
  p_payment_method            text,
  p_amount                    numeric,
  p_currency                  text,
  p_pricing_policy_used       extension_pricing_policy,
  p_existing_extension_id     uuid default null,
  p_penalty_amount            numeric default null,
  p_penalty_policy_used       text default null,
  p_penalty_rate_used         numeric default null
)
returns table (
  extension_id           uuid,
  status                 text,
  payment_status         payment_status,
  rejection_reason       text,
  is_late                boolean,
  penalty_amount         numeric,
  conflict_booking_id    uuid,
  replacement_vehicle_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking                record;
  v_existing               record;
  v_extension_id           uuid;
  v_extension_days         integer;
  v_is_late                boolean;
  v_status                 text;
  v_payment_status         payment_status;
  v_rejection_reason       text;
  v_current_policy         extension_pricing_policy;
  v_current_penalty_policy text;
  v_resolution             text;
  v_conflict_booking_id    uuid;
  v_replacement_vehicle_id uuid;
begin
  if not is_admin() then
    raise exception 'Only an active admin can process rental extensions.';
  end if;

  if p_payment_method not in ('cash', 'online') then
    raise exception 'Payment method must be cash or online.';
  end if;

  if p_amount < 0 then
    raise exception 'Extension amount must not be negative.';
  end if;

  select policy into v_current_policy from extension_pricing_settings where id = 1;
  if v_current_policy is null then
    raise exception 'Extension pricing policy has not been configured yet. Ask the owner to set it in Settings before processing extensions.';
  end if;
  if p_pricing_policy_used is distinct from v_current_policy then
    raise exception 'The pricing policy has changed since this amount was calculated. Please recalculate and try again.';
  end if;

  if p_existing_extension_id is not null then
    select * into v_existing from booking_extensions where id = p_existing_extension_id for update;
    if not found then
      raise exception 'Extension request not found.';
    end if;
    if v_existing.status not in ('requested', 'conflict_unresolved') then
      raise exception 'This extension request has already been processed.';
    end if;
    if v_existing.booking_id <> p_booking_id then
      raise exception 'Booking mismatch for this extension request.';
    end if;
    if v_existing.requested_return_date <> p_requested_return_date then
      raise exception 'The requested return date no longer matches this request. Reject it and ask the customer to resubmit if the dates need to change.';
    end if;
  else
    if p_support_confirmed_by is null or btrim(p_support_confirmed_by) = '' then
      raise exception 'Who confirmed this with the customer is required.';
    end if;
  end if;

  -- Lock the booking row so a concurrent status/date change can't
  -- interleave with this check, same reasoning as create_booking's
  -- vehicle-row lock in Phase 2.
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status not in ('confirmed', 'active') then
    raise exception 'Only a confirmed or active rental can be extended (this booking is %).', v_booking.status;
  end if;

  v_extension_days := p_requested_return_date - v_booking.end_date;
  if v_extension_days < 1 or v_extension_days > 30 then
    raise exception 'Extension length must be between 1 and 30 days (requested %).', v_extension_days;
  end if;

  v_is_late := current_date > v_booking.end_date;

  if v_is_late then
    select policy into v_current_penalty_policy from extension_penalty_settings where id = 1;
    if v_current_penalty_policy is null then
      raise exception 'This extension is late (the original return date has already passed) and the late-extension penalty has not been configured yet. Ask the owner to set it in Settings before processing late extensions.';
    end if;
    if p_penalty_policy_used is distinct from v_current_penalty_policy then
      raise exception 'The late-extension penalty policy has changed since this amount was calculated. Please recalculate and try again.';
    end if;
    if p_penalty_amount is null or p_penalty_amount < 0 then
      raise exception 'A non-negative penalty amount is required for a late extension.';
    end if;
  elsif p_penalty_amount is not null and p_penalty_amount <> 0 then
    raise exception 'A penalty amount was provided but this extension is not late.';
  end if;

  if p_existing_extension_id is not null then
    v_extension_id := p_existing_extension_id;
    update booking_extensions set
      support_confirmed_by      = nullif(btrim(coalesce(p_support_confirmed_by, '')), ''),
      support_confirmation_note = p_support_confirmation_note,
      pricing_policy_used       = p_pricing_policy_used,
      amount                    = p_amount,
      currency                  = p_currency,
      payment_method            = p_payment_method,
      is_late                   = v_is_late,
      penalty_amount            = p_penalty_amount,
      penalty_policy_used       = p_penalty_policy_used,
      penalty_rate_used         = p_penalty_rate_used,
      processed_by              = auth.uid()
    where id = v_extension_id;
  else
    insert into booking_extensions (
      booking_id, vehicle_id, previous_return_date, requested_return_date, extension_days,
      pricing_policy_used, amount, currency, payment_method, is_late, penalty_amount, penalty_policy_used,
      penalty_rate_used, status, support_confirmed_by, support_confirmation_note, processed_by, source
    ) values (
      p_booking_id, v_booking.vehicle_id, v_booking.end_date, p_requested_return_date, v_extension_days,
      p_pricing_policy_used, p_amount, p_currency, p_payment_method, v_is_late, p_penalty_amount, p_penalty_policy_used,
      p_penalty_rate_used, 'pending', btrim(p_support_confirmed_by), p_support_confirmation_note, auth.uid(), 'admin'
    )
    returning id into v_extension_id;

    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (
      auth.uid(), 'extension_requested', 'booking_extensions', v_extension_id,
      jsonb_build_object(
        'booking_id', p_booking_id, 'vehicle_id', v_booking.vehicle_id, 'source', 'admin',
        'previous_return_date', v_booking.end_date, 'requested_return_date', p_requested_return_date,
        'extension_days', v_extension_days, 'support_confirmed_by', p_support_confirmed_by, 'is_late', v_is_late
      )
    );
  end if;

  if p_payment_method = 'cash' then
    v_resolution := resolve_extension_conflict(v_extension_id, p_booking_id, v_booking.vehicle_id, p_requested_return_date, auth.uid());

    select conflict_booking_id, replacement_vehicle_id into v_conflict_booking_id, v_replacement_vehicle_id
    from booking_extensions where id = v_extension_id;

    if v_resolution = 'unresolved' then
      v_status := 'conflict_unresolved';
      v_payment_status := null;
      v_rejection_reason := 'Vehicle ' || (select plate_number from vehicles where id = v_booking.vehicle_id)
        || ' has a future booking overlapping the requested dates and no suitable replacement vehicle is currently available. This needs manual admin handling — no automatic decision was made.';
      update booking_extensions set status = v_status where id = v_extension_id;
    else
      v_status := 'approved';
      v_payment_status := 'paid';
      v_rejection_reason := null;

      update bookings set end_date = p_requested_return_date where id = p_booking_id;
      update booking_extensions
        set status = v_status, payment_status = v_payment_status, availability_confirmed = true, payment_confirmed_by = auth.uid()
        where id = v_extension_id;

      insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
      values (auth.uid(), 'booking_return_date_changed', 'bookings', p_booking_id,
        jsonb_build_object('previous_return_date', v_booking.end_date, 'new_return_date', p_requested_return_date, 'extension_id', v_extension_id));
      insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
      values (auth.uid(), 'extension_payment_recorded', 'booking_extensions', v_extension_id,
        jsonb_build_object('method', 'cash', 'amount', p_amount, 'currency', p_currency, 'penalty_amount', p_penalty_amount, 'penalty_rate_used', p_penalty_rate_used));
      insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
      values (auth.uid(), 'extension_approved', 'booking_extensions', v_extension_id, jsonb_build_object('payment_method', 'cash'));

      if p_existing_extension_id is not null then
        insert into booking_notifications (booking_id, notification_type, payload)
        values (p_booking_id, 'extension_approved', jsonb_build_object(
          'requested_return_date', p_requested_return_date, 'extension_days', v_extension_days,
          'amount', p_amount, 'currency', p_currency, 'penalty_amount', p_penalty_amount));
      end if;
    end if;
  else
    -- Online: leave pending. Conflict resolution and the booking's own
    -- end_date change are BOTH deferred to confirm_booking_extension_payment,
    -- so a future booking is never reassigned for an extension whose
    -- payment might still fail.
    v_status := 'pending';
    v_payment_status := 'pending';
    v_rejection_reason := null;
    update booking_extensions set status = v_status, payment_status = v_payment_status where id = v_extension_id;
  end if;

  return query select v_extension_id, v_status, v_payment_status, v_rejection_reason, v_is_late, p_penalty_amount, v_conflict_booking_id, v_replacement_vehicle_id;
end;
$$;

revoke all on function request_booking_extension(uuid, date, text, text, text, numeric, text, extension_pricing_policy, uuid, numeric, text, numeric) from public;
grant execute on function request_booking_extension(uuid, date, text, text, text, numeric, text, extension_pricing_policy, uuid, numeric, text, numeric) to authenticated;

comment on function request_booking_extension is
  'Phase 7. SECURITY DEFINER, is_admin() checked inside. Adds p_penalty_rate_used (trailing, optional) on top of the booking-reassignment version — the raw configured penalty value (percentage/per-day/fixed-fee) frozen onto the extension row at processing time, alongside the existing penalty_amount/penalty_policy_used, so a later change to extension_penalty_settings can never alter what an already-processed extension is shown to have used. Everything else (two entry points, conflict/reassignment handling, cash-vs-online sequencing) is unchanged from 20260903000000_phase7_booking_reassignment.sql.';

-- ---------------------------------------------------------------------------
-- 3. Audit trail for extension pricing/penalty settings changes — same
--    plain-trigger-inserts-into-audit_logs pattern as audit_vehicle_change/
--    audit_pricing_change/audit_complaint_status_change
--    (20260827000000_phase3_admin_dashboard.sql). Runs as the invoking
--    role (NOT security definer), so it only ever succeeds when the update
--    itself already passed the "super admins update extension ... settings"
--    RLS policy — this trigger adds a record of the change, it does not
--    grant anything. entity_id is left null (these are singleton id=1
--    smallint rows, not uuid-keyed) — the settings table name in
--    entity_table plus the before/after values in metadata identify the
--    change fully.
-- ---------------------------------------------------------------------------
create or replace function audit_extension_pricing_settings_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and (
    old.policy is distinct from new.policy
    or old.custom_daily_rate is distinct from new.custom_daily_rate
    or old.custom_currency is distinct from new.custom_currency
  ) then
    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (
      auth.uid(),
      'extension_pricing_settings_changed',
      'extension_pricing_settings',
      null,
      jsonb_build_object(
        'previous_policy', old.policy, 'new_policy', new.policy,
        'previous_custom_daily_rate', old.custom_daily_rate, 'new_custom_daily_rate', new.custom_daily_rate,
        'previous_custom_currency', old.custom_currency, 'new_custom_currency', new.custom_currency
      )
    );
  end if;
  return new;
end;
$$;

create trigger extension_pricing_settings_audit
  after update on extension_pricing_settings
  for each row
  execute function audit_extension_pricing_settings_change();

create or replace function audit_extension_penalty_settings_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and (
    old.policy is distinct from new.policy
    or old.fixed_fee_amount is distinct from new.fixed_fee_amount
    or old.per_day_amount is distinct from new.per_day_amount
    or old.percentage_rate is distinct from new.percentage_rate
    or old.currency is distinct from new.currency
  ) then
    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (
      auth.uid(),
      'extension_penalty_settings_changed',
      'extension_penalty_settings',
      null,
      jsonb_build_object(
        'previous_policy', old.policy, 'new_policy', new.policy,
        'previous_fixed_fee_amount', old.fixed_fee_amount, 'new_fixed_fee_amount', new.fixed_fee_amount,
        'previous_per_day_amount', old.per_day_amount, 'new_per_day_amount', new.per_day_amount,
        'previous_percentage_rate', old.percentage_rate, 'new_percentage_rate', new.percentage_rate,
        'previous_currency', old.currency, 'new_currency', new.currency
      )
    );
  end if;
  return new;
end;
$$;

create trigger extension_penalty_settings_audit
  after update on extension_penalty_settings
  for each row
  execute function audit_extension_penalty_settings_change();

comment on function audit_extension_penalty_settings_change is
  'Records every actual change (any field) to the singleton late-extension penalty policy — who (auth.uid(), the super_admin who saved Settings), what changed (previous/new values for every column), and when (audit_logs.created_at) — so an owner changing 10% to 15% later leaves a normal audit trail, same as any other admin action in this project. Reuses audit_logs; no separate audit table.';
