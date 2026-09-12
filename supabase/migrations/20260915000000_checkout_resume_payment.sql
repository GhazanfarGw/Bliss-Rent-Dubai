-- =============================================================================
-- Checkout / Payment Flow Recovery — backend support
--
-- Context: a guest customer who goes Payment → Back to Summary → Continue
-- to Payment again hits a false "This vehicle was just booked for
-- overlapping dates" error, because BookingSummaryPage previously called
-- create_booking() again on every click with no memory of the booking it
-- already created. The bookings_no_overlap exclusion constraint (Phase 0)
-- correctly rejects that second insert — it is doing its job — but the
-- customer's own still-pending booking becomes stranded with no way back
-- to it. Reproduced directly against production data before writing this
-- migration: see claude/checkout-payment-flow-recovery-2026-09-02.md.
--
-- The fix for THAT bug is entirely frontend (BookingSummaryPage now
-- remembers its own created booking in sessionStorage and resumes it
-- instead of re-submitting — see checkoutStorage.ts). Nothing here
-- touches create_booking(), confirm_payment(), the bookings_no_overlap
-- constraint, pricing, or RLS.
--
-- Two small, additive, genuinely-required backend gaps this migration
-- closes:
--
-- 1. lookup_booking_for_customer() (existing, guest-safe, unchanged
--    security model) did not return enough columns to resume payment
--    from the Manage Booking page (cross-device/cross-session case) —
--    PaymentPage needs paymentId, and the checkout route needs
--    vehicleId + pickup/dropoff location ids to build its URL. Adding
--    four columns to what is already a public, non-sensitive read.
--
-- 2. There was no admin-facing way to mark an ORIGINAL booking's payment
--    as paid (only extensions had a manual cash-confirm path, Phase 7).
--    admin_confirm_booking_payment() adds that, gated Super-Admin-only —
--    the exact same authorization rule the owner already approved for
--    cash extensions (20260908000000_phase7_cash_extension_super_admin_only.sql).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. lookup_booking_for_customer — add the columns needed to resume payment.
-- Return shape changes (new OUT columns), so this must be dropped and
-- recreated rather than CREATE OR REPLACE'd. Everything else about the
-- function — its guest-safe single-field matching, the deliberate
-- reference-OR-plate trade-off documented in the original migration, the
-- "zero rows on no match" contract — is unchanged.
-- ---------------------------------------------------------------------------
drop function if exists lookup_booking_for_customer(text);

create function lookup_booking_for_customer(p_query text)
returns table (
  booking_id            uuid,
  booking_reference     text,
  booking_status        booking_status,
  start_date            date,
  end_date              date,
  total_price           numeric,
  currency              text,
  vehicle_id            uuid,
  vehicle_make          text,
  vehicle_model         text,
  vehicle_plate         text,
  pickup_location_id    uuid,
  dropoff_location_id   uuid,
  pickup_location_name  text,
  dropoff_location_name text,
  customer_name         text,
  payment_id            uuid,
  payment_status        payment_status,
  created_at            timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_normalized text;
  v_ref_suffix text;
begin
  if p_query is null or btrim(p_query) = '' then
    return;
  end if;

  v_normalized := upper(replace(btrim(p_query), ' ', ''));
  v_ref_suffix := upper(regexp_replace(v_normalized, '^BLS-?', ''));

  return query
    select
      b.id,
      'BLS-' || upper(left(replace(b.id::text, '-', ''), 8)),
      b.status,
      b.start_date,
      b.end_date,
      b.total_price,
      b.currency,
      v.id,
      v.make,
      v.model,
      v.plate_number,
      b.pickup_location_id,
      b.dropoff_location_id,
      pl.name,
      dl.name,
      c.full_name,
      pay.id,
      pay.status,
      b.created_at
    from bookings b
    join customers c on c.id = b.customer_id
    join vehicles v on v.id = b.vehicle_id
    join locations pl on pl.id = b.pickup_location_id
    join locations dl on dl.id = b.dropoff_location_id
    left join lateral (
      select p2.id, p2.status from payments p2 where p2.booking_id = b.id order by p2.created_at desc limit 1
    ) pay on true
    where upper(left(replace(b.id::text, '-', ''), 8)) = v_ref_suffix
       or upper(replace(v.plate_number, ' ', '')) = v_normalized
    order by
      (upper(left(replace(b.id::text, '-', ''), 8)) = v_ref_suffix) desc,
      (b.status = 'active') desc,
      (b.status = 'confirmed') desc,
      b.created_at desc
    limit 1;
end;
$$;

comment on function lookup_booking_for_customer is
  'Guest-safe booking lookup by EITHER booking reference OR vehicle plate number alone — see the original 20260904000000 migration for the deliberate, owner-approved single-field security trade-off. Extended 2026-09-15 with payment_id/vehicle_id/pickup_location_id/dropoff_location_id so the Manage Booking page can resume payment for a pending_payment booking without a second lookup. Zero rows on no match, unchanged.';

grant execute on function lookup_booking_for_customer(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. admin_confirm_booking_payment — Super-Admin-only manual "mark paid".
--
-- Mirrors confirm_booking_extension_payment's shape (idempotent, single
-- atomic UPDATE pair) and request_booking_extension's cash-path
-- authorization rule (is_super_admin() only). Only usable on an ORIGINAL
-- booking still in 'pending_payment' with a 'pending' or 'failed'
-- payment — never touches a confirmed/active/completed/cancelled booking,
-- never re-opens an already-paid payment (idempotent no-op instead), and
-- never touches pricing or availability. Called directly from the admin
-- session (authenticated role) — no Edge Function needed, same as every
-- other admin-triggered write in this project.
-- ---------------------------------------------------------------------------
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

  insert into audit_logs (actor_id, action, entity_type, entity_id, metadata)
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
  'Super-Admin-only manual "mark paid" for an ORIGINAL booking stuck in pending_payment (e.g. a stranded guest checkout, or an offline/cash arrangement) — the original-booking counterpart to Phase 7''s cash-extension confirmation, same is_super_admin() gate. Idempotent. Never touches pricing, availability, or any booking not currently pending_payment.';

revoke all on function admin_confirm_booking_payment(uuid, text) from public;
grant execute on function admin_confirm_booking_payment(uuid, text) to authenticated;
