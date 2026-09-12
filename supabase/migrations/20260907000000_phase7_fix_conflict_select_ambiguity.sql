-- =============================================================================
-- Phase 7 — Fix: ambiguous column reference breaking EVERY cash extension
-- (2026-08-29, found during the Phase 7 end-to-end PRODUCTION verification
-- run immediately after 20260905000000/20260906000000 were deployed)
--
-- BUG: request_booking_extension()'s cash-payment branch runs
--
--   select conflict_booking_id, replacement_vehicle_id
--     into v_conflict_booking_id, v_replacement_vehicle_id
--     from booking_extensions where id = v_extension_id;
--
-- immediately after calling resolve_extension_conflict(). conflict_booking_id
-- and replacement_vehicle_id are ALSO two of this function's own RETURNS
-- TABLE column names — plpgsql implicitly exposes RETURNS TABLE columns as
-- variables inside the function body, so the two bare, unqualified names in
-- that SELECT are ambiguous between "the booking_extensions table column"
-- and "the function's own output variable of the same name". Postgres
-- raises `42702: column reference "conflict_booking_id" is ambiguous` and
-- the ENTIRE call fails — for EVERY cash extension, conflict or not, since
-- this SELECT runs unconditionally inside the `if p_payment_method = 'cash'`
-- branch. This is not a business-logic bug (the conflict/reassignment
-- design itself, resolve_extension_conflict, is untouched and correct) —
-- it's a plain PL/pgSQL naming collision that could only be caught by
-- actually EXECUTING this function against a live Postgres, which never
-- happened before this session's end-to-end production verification (every
-- prior Phase 7 report explicitly disclosed "code-reviewed, not
-- automated-tested — no live database in this sandbox").
--
-- SCOPE: this bug has existed since 20260903000000_phase7_booking_reassignment.sql
-- first introduced it, carried forward unchanged through
-- 20260906000000_phase7_penalty_admin_control_and_audit.sql (which only
-- added the trailing p_penalty_rate_used parameter and its own storage —
-- it did not touch this line). Every cash-payment extension request — both
-- the WhatsApp/admin-recorded channel and an admin reviewing a
-- customer-submitted request — has been broken in production from the
-- moment 20260903000000 was applied until this fix. Online-payment
-- extensions (confirm_booking_extension_payment) were NOT affected — that
-- function has no equivalent unqualified select.
--
-- FIX: qualify the SELECT with the table's own alias (`be`), which Postgres
-- resolves unambiguously as "the table column", exactly as this project's
-- other multi-statement plpgsql functions already do wherever a bare column
-- name could otherwise collide with a variable (see resolve_extension_conflict's
-- consistent use of table aliases). No other line in request_booking_extension
-- or confirm_booking_extension_payment has this collision — verified by
-- checking every unqualified SELECT/UPDATE...RETURNING against both
-- functions' RETURNS TABLE column lists.
--
-- Function body is otherwise byte-for-byte identical to
-- 20260906000000_phase7_penalty_admin_control_and_audit.sql's version —
-- same 12-parameter signature, same grants, same comment convention.
-- =============================================================================

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

    -- FIX (this migration): qualified with the "be" alias so Postgres
    -- resolves these as the booking_extensions table columns, never the
    -- function's own conflict_booking_id/replacement_vehicle_id OUT
    -- variables (RETURNS TABLE columns are implicitly visible as plpgsql
    -- variables of the same name, which made the previous unqualified
    -- SELECT genuinely ambiguous — see migration header).
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
  'Phase 7. SECURITY DEFINER, is_admin() checked inside. Fixed 2026-08-29 (20260907000000): the post-resolve_extension_conflict SELECT now qualifies conflict_booking_id/replacement_vehicle_id with the booking_extensions table alias, resolving a genuine ambiguity against this function''s own RETURNS TABLE columns of the same name that made EVERY cash-payment extension fail in production — see migration header. Otherwise unchanged from 20260906000000: two modes (p_existing_extension_id null = new admin/WhatsApp-channel row, processed immediately; supplied = review of a customer-submitted ''requested'' row), 1-30 day validation, exact-vehicle check, configured-penalty check when late, resolve_extension_conflict() for reassignment before ever falling back to conflict_unresolved, cash finalizes in the same transaction, online left pending for confirm_booking_extension_payment.';
