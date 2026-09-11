-- =============================================================================
-- Extension price preview + before/after email breakdown
-- (owner request 2026-09-05: "when user go to extend days there is no new
-- payment value add show... user can see easily new payment plan like
-- current paid payment show 2000 then new payment plan 6000 after
-- extend... even send email to user updated payment like that")
--
-- Two independent, narrowly-scoped additions. Neither changes any pricing,
-- booking, or extension BUSINESS rule — both are read/notification-only.
--
-- 1) get_extension_estimate_config() — a NEW, narrow, public, read-only
--    RPC. Today extension_pricing_settings/extension_penalty_settings are
--    admin-only (`for select using (is_admin())`), which is why a
--    customer-facing "estimated new total" preview could not be computed
--    accurately before submitting an extension request — the frontend had
--    no legitimate way to know whether the live policy is current_rate /
--    original_rate / custom_rate (or the late-penalty policy), so it could
--    only ever GUESS. This function exposes exactly the handful of columns
--    needed to run the EXISTING, unchanged computeExtensionAmount() /
--    computeExtensionPenalty() pure functions (src/lib/extensionPricing.ts,
--    src/lib/extensionPenalty.ts) client-side against a chosen day count —
--    nothing else from either settings table (no updated_by/updated_at
--    audit columns, no other admin-only data) is exposed. The vehicle's
--    current daily rate itself is already public (see the "public reads
--    pricing" policy in 20260824000000_phase0_foundation.sql) — this
--    function only closes the ONE remaining gap: which policy is active.
--    SECURITY DEFINER is required only to read past the existing
--    admin-only RLS on these two settings tables; it performs no writes
--    and takes no arguments.
--
-- 2) previous_total_price added to the extension_approved
--    booking_notifications payload, in BOTH places that payload is built
--    (confirm_booking_extension_payment's online-payment path,
--    request_booking_extension's cash-payment path for a
--    customer-submitted request). bookings.total_price is never mutated
--    by an extension (only bookings.end_date is), so it is always exactly
--    the amount the customer already paid at booking time — reading it
--    here lets extensionApprovedContent() (see
--    supabase/functions/_shared/email/extensionNotificationContent.ts)
--    render "You paid X. This extension: Y. New total: X+Y" instead of
--    just "Amount charged: Y". No other column, table, or business rule
--    touched; both functions are otherwise byte-for-byte identical to
--    their previous versions (request_booking_extension:
--    20260907000000_phase7_fix_conflict_select_ambiguity.sql,
--    confirm_booking_extension_payment:
--    20260903000000_phase7_booking_reassignment.sql).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) get_extension_estimate_config()
-- ---------------------------------------------------------------------------
create or replace function get_extension_estimate_config()
returns table (
  pricing_policy          extension_pricing_policy,
  custom_daily_rate       numeric,
  custom_currency         text,
  penalty_policy          text,
  penalty_fixed_fee       numeric,
  penalty_per_day         numeric,
  penalty_percentage_rate numeric,
  penalty_currency        text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    eps.policy, eps.custom_daily_rate, eps.custom_currency,
    epn.policy, epn.fixed_fee_amount, epn.per_day_amount, epn.percentage_rate, epn.currency
  from extension_pricing_settings eps
  cross join extension_penalty_settings epn
  where eps.id = 1 and epn.id = 1;
$$;

comment on function get_extension_estimate_config is
  'Public, read-only. Exposes ONLY the fields needed to run computeExtensionAmount()/computeExtensionPenalty() (src/lib/extensionPricing.ts, src/lib/extensionPenalty.ts) client-side for a pre-submission "estimated new total" preview — never the full admin settings rows (no updated_by/updated_at). SECURITY DEFINER solely to read past the admin-only RLS on extension_pricing_settings/extension_penalty_settings; performs no writes. Added 2026-09-05 for the extension price-preview feature.';

grant execute on function get_extension_estimate_config() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2a) request_booking_extension — cash-payment path: add previous_total_price
--     to the extension_approved notification payload. Identical otherwise to
--     20260907000000_phase7_fix_conflict_select_ambiguity.sql.
-- ---------------------------------------------------------------------------
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

    select be.conflict_booking_id, be.replacement_vehicle_id into v_conflict_booking_id, v_replacement_vehicle_id
    from booking_extensions be where be.id = v_extension_id;

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
          'amount', p_amount, 'currency', p_currency, 'penalty_amount', p_penalty_amount,
          'previous_total_price', v_booking.total_price));
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
  'Phase 7. SECURITY DEFINER, is_admin() checked inside. 2026-09-05: the customer-submitted-request cash-approval branch now also includes previous_total_price (the booking''s total_price, never mutated by an extension) in the extension_approved booking_notifications payload, so the confirmation email can show a paid/added/new-total breakdown — see migration header. Otherwise byte-for-byte unchanged from 20260907000000: two modes (p_existing_extension_id null = new admin/WhatsApp-channel row, processed immediately; supplied = review of a customer-submitted ''requested'' row), 1-30 day validation, exact-vehicle check, configured-penalty check when late, resolve_extension_conflict() for reassignment before ever falling back to conflict_unresolved, cash finalizes in the same transaction, online left pending for confirm_booking_extension_payment.';

-- ---------------------------------------------------------------------------
-- 2b) confirm_booking_extension_payment — online-payment path: add
--     previous_total_price to the extension_approved notification payload.
--     Identical otherwise to 20260903000000_phase7_booking_reassignment.sql.
-- ---------------------------------------------------------------------------
create or replace function confirm_booking_extension_payment(
  p_extension_id uuid,
  p_outcome      payment_status,
  p_reference    text
)
returns table (
  extension_id   uuid,
  status         text,
  payment_status payment_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ext                  record;
  v_resolution           text;
  v_original_total_price numeric;
begin
  if not is_admin() then
    raise exception 'Only an active admin can confirm an extension payment.';
  end if;

  if p_outcome not in ('paid', 'failed') then
    raise exception 'Outcome must be paid or failed.';
  end if;

  select * into v_ext from booking_extensions where id = p_extension_id for update;
  if not found then
    raise exception 'Extension not found.';
  end if;

  if v_ext.payment_method <> 'online' then
    raise exception 'Only an online extension payment can be confirmed this way.';
  end if;

  -- Idempotency: already resolved just returns its current state again.
  if v_ext.payment_status in ('paid', 'failed') then
    return query select v_ext.id, v_ext.status, v_ext.payment_status;
    return;
  end if;

  if p_outcome = 'failed' then
    update booking_extensions
    set payment_status = 'failed', payment_confirmed_by = auth.uid()
    where id = p_extension_id;

    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (auth.uid(), 'extension_payment_recorded', 'booking_extensions', p_extension_id, jsonb_build_object('method', 'online', 'outcome', 'failed', 'reference', p_reference));

    return query select p_extension_id, v_ext.status, 'failed'::payment_status;
    return;
  end if;

  v_resolution := resolve_extension_conflict(p_extension_id, v_ext.booking_id, v_ext.vehicle_id, v_ext.requested_return_date, auth.uid());

  if v_resolution = 'unresolved' then
    update booking_extensions set status = 'conflict_unresolved' where id = p_extension_id;
    return query select p_extension_id, 'conflict_unresolved'::text, v_ext.payment_status;
    return;
  end if;

  -- The actual double-booking guard, applied at the moment the extra days
  -- are actually granted: if another booking for this exact vehicle was
  -- committed for an overlapping date since the original request,
  -- bookings_no_overlap raises 23P01 here and the whole payment
  -- confirmation (including any reassignment resolve_extension_conflict
  -- just made) rolls back together — the extension stays pending/unpaid
  -- rather than being silently marked paid for days the vehicle can no
  -- longer cover.
  update bookings set end_date = v_ext.requested_return_date where id = v_ext.booking_id;

  update booking_extensions
  set payment_status = 'paid', status = 'approved', availability_confirmed = true, payment_confirmed_by = auth.uid()
  where id = p_extension_id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (
    auth.uid(), 'booking_return_date_changed', 'bookings', v_ext.booking_id,
    jsonb_build_object('previous_return_date', v_ext.previous_return_date, 'new_return_date', v_ext.requested_return_date, 'extension_id', p_extension_id)
  );
  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (auth.uid(), 'extension_payment_recorded', 'booking_extensions', p_extension_id, jsonb_build_object('method', 'online', 'outcome', 'paid', 'reference', p_reference));
  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (auth.uid(), 'extension_approved', 'booking_extensions', p_extension_id, jsonb_build_object('payment_method', 'online'));

  if v_ext.source = 'customer' then
    -- 2026-09-05: previous_total_price is bookings.total_price as it
    -- stood BEFORE this extension — safe to read at any point in this
    -- transaction since an extension never mutates total_price (only
    -- end_date). Read after the end_date update above purely for
    -- proximity to where it's used; the value is unaffected either way.
    select total_price into v_original_total_price from bookings where id = v_ext.booking_id;

    insert into booking_notifications (booking_id, notification_type, payload)
    values (v_ext.booking_id, 'extension_approved', jsonb_build_object(
      'requested_return_date', v_ext.requested_return_date, 'extension_days', v_ext.extension_days,
      'amount', v_ext.amount, 'currency', v_ext.currency, 'penalty_amount', v_ext.penalty_amount,
      'previous_total_price', v_original_total_price));
  end if;

  return query select p_extension_id, 'approved'::text, 'paid'::payment_status;
end;
$$;

revoke all on function confirm_booking_extension_payment(uuid, payment_status, text) from public;
grant execute on function confirm_booking_extension_payment(uuid, payment_status, text) to authenticated;

comment on function confirm_booking_extension_payment is
  'Phase 7. Second step for an ONLINE extension only. Idempotent like Phase 2''s confirm_payment. 2026-09-05: the customer-notification branch now also includes previous_total_price (bookings.total_price, never mutated by an extension) in the extension_approved payload, so the confirmation email can show a paid/added/new-total breakdown. Otherwise unchanged: runs resolve_extension_conflict() here (not earlier), since payment success is the first moment it is safe to actually reassign a future booking — an extension whose online payment fails never touches anyone else''s vehicle.';
