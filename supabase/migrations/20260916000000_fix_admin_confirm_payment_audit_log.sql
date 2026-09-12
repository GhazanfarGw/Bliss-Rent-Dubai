-- =============================================================================
-- Fix: admin_confirm_booking_payment() referenced a non-existent audit_logs
-- column.
--
-- The 20260915000000_checkout_resume_payment.sql migration's INSERT used
-- `entity_type`, but the real column (confirmed against the live schema via
-- information_schema.columns) is `entity_table`. Every other write in this
-- codebase already uses entity_table correctly (see e.g. Phase 7's
-- request_booking_extension / confirm_booking_extension_payment) — this was
-- a genuine typo introduced in the previous migration, not a schema change.
--
-- Impact before this fix: any real call to admin_confirm_booking_payment
-- that reached the final INSERT would fail with
-- "column \"entity_type\" of relation \"audit_logs\" does not exist" and the
-- whole call would roll back (payments/bookings updates included, since a
-- PL/pgSQL function body is one implicit transaction) — so no booking was
-- ever incorrectly left half-updated by this function. Caught during
-- post-deploy investigation, before any real admin use, via a direct
-- information_schema check against the live database. No frontend change
-- needed — adminConfirmBookingPayment() and BookingDetailPage's UI were
-- already correct; only this one column name inside the function body was
-- wrong.
--
-- Signature and RETURNS TABLE are unchanged, so CREATE OR REPLACE is safe
-- (no drop needed).
-- =============================================================================
create or replace function admin_confirm_booking_payment(
  p_booking_id uuid,
  p_note       text default null
)
returns table (
  booking_id     uuid,
  payment_id     uuid,
  booking_status booking_status,
  payment_status payment_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking  bookings%rowtype;
  v_payment  payments%rowtype;
begin
  if not is_super_admin() then
    raise exception 'Only a Super Admin can confirm a booking payment manually.';
  end if;

  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;

  select * into v_payment
  from payments
  where payments.booking_id = p_booking_id
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No payment record found for this booking.';
  end if;

  -- Idempotent: an already-paid payment just reports its current state
  -- again rather than erroring — same convention as confirm_payment.
  if v_payment.status = 'paid' then
    return query select v_booking.id, v_payment.id, v_booking.status, v_payment.status;
    return;
  end if;

  if v_booking.status <> 'pending_payment' then
    raise exception 'Only a booking awaiting payment can be confirmed this way (current status: %).', v_booking.status;
  end if;

  if v_payment.status not in ('pending', 'failed') then
    raise exception 'This payment cannot be confirmed manually (current status: %).', v_payment.status;
  end if;

  update payments
  set status = 'paid',
      provider = 'cash',
      provider_reference = 'admin-cash-confirmed' || case when p_note is not null and btrim(p_note) <> '' then ': ' || btrim(p_note) else '' end,
      paid_at = now()
  where id = v_payment.id;

  update bookings
  set status = 'confirmed'
  where id = v_booking.id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (
    auth.uid(),
    'booking_payment_manually_confirmed',
    'bookings',
    v_booking.id,
    jsonb_build_object('payment_id', v_payment.id, 'amount', v_payment.amount, 'currency', v_payment.currency, 'note', p_note)
  );

  return query select v_booking.id, v_payment.id, 'confirmed'::booking_status, 'paid'::payment_status;
end;
$$;

comment on function admin_confirm_booking_payment is
  'Super-Admin-only manual "mark paid" for an ORIGINAL booking stuck in pending_payment (e.g. a stranded guest checkout, or an offline/cash arrangement) — the original-booking counterpart to Phase 7''s cash-extension confirmation, same is_super_admin() gate. Idempotent. Never touches pricing, availability, or any booking not currently pending_payment. Fixed 2026-09-02: audit_logs insert now uses the correct entity_table column (was entity_type).';
