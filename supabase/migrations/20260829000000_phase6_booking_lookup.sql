-- ---------------------------------------------------------------------------
-- Phase 6 — Booking Engine & Reservation System.
--
-- AUDIT FINDING (see docs/Phase6_Report.pdf / project doc for the full
-- audit): every other Phase 6 in-scope item — vehicle availability
-- (available_vehicles(), Phase 1), double-booking prevention
-- (bookings_no_overlap exclusion constraint, Phase 0), booking creation
-- (create_booking(), Phase 2), booking data model (Phase 0/2), pricing
-- integration (create-booking Edge Function reusing src/lib/pricing.ts,
-- Phase 2), customer flow integration (Phase 2), booking confirmation
-- (confirm_payment(), Phase 2, guarded Phase 5), and admin compatibility
-- (adminBookingsApi.ts, Phase 3) already exist and are reused as-is —
-- nothing above is rebuilt or changed by this migration.
--
-- The one genuine gap: "Booking Retrieval" (Get booking / Get customer
-- booking / Get booking status), explicitly required by the Phase 6
-- brief. This is a guest-checkout project (Phase 0/2, by design — see
-- docs/ARCHITECTURE.md): there is no authenticated customer session, so
-- the existing Phase 0 RLS policy "customers read own bookings" (which
-- keys off customers.auth_user_id = auth.uid()) can never match a booking
-- created through the guest checkout flow, since create_booking() never
-- populates auth_user_id. ConfirmationPage.tsx already documents this —
-- it only reads a same-browser sessionStorage snapshot and cannot
-- re-fetch from a different device/browser or after a cleared tab.
--
-- FIX: one new SECURITY DEFINER, read-only function —
-- get_booking_by_reference(reference, email) — the same pattern already
-- used for available_vehicles() (Phase 1): SECURITY DEFINER so it can
-- check the private bookings/customers/payments tables server-side, but
-- it returns only a small, non-sensitive summary (no driver license
-- number/country/expiry, no license/ID document storage paths, no
-- customer phone) — the same field set already shown to the customer on
-- ConfirmationPage, nothing more. The email must match the booking's
-- customer exactly (case-insensitive) or zero rows are returned — the
-- same "not found" response whether the reference or the email was
-- wrong, so the function can't be used as an oracle to test whether a
-- given reference exists at all.
--
-- This single function serves all three named APIs at once, which is the
-- correct minimal shape for a guest-checkout system (no persistent
-- customer account to list "my bookings" from — that would be a new
-- account/auth feature, out of Phase 6's explicit scope):
--   - "Get booking"          -> reference + email identifies the booking.
--   - "Get customer booking" -> the email check IS the customer check.
--   - "Get booking status"   -> booking_status is one of the returned columns.
-- ---------------------------------------------------------------------------
create or replace function get_booking_by_reference(p_booking_reference text, p_email text)
returns table (
  booking_id uuid,
  booking_reference text,
  booking_status booking_status,
  start_date date,
  end_date date,
  total_price numeric,
  currency text,
  vehicle_make text,
  vehicle_model text,
  pickup_location_name text,
  dropoff_location_name text,
  customer_name text,
  payment_status payment_status,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_suffix text;
begin
  if p_booking_reference is null or trim(p_booking_reference) = '' or p_email is null or trim(p_email) = '' then
    return;
  end if;

  -- Strip the constant 'BLS-' prefix (case-insensitive) so callers can
  -- pass the reference exactly as displayed. Anything else is not a
  -- reference this system ever issued and can never match.
  v_suffix := upper(regexp_replace(trim(p_booking_reference), '^BLS-', '', 'i'));

  return query
    select
      b.id,
      'BLS-' || upper(left(replace(b.id::text, '-', ''), 8)),
      b.status,
      b.start_date,
      b.end_date,
      b.total_price,
      b.currency,
      v.make,
      v.model,
      pl.name,
      dl.name,
      c.full_name,
      p.status,
      b.created_at
    from bookings b
    join customers c on c.id = b.customer_id
    join vehicles v on v.id = b.vehicle_id
    join locations pl on pl.id = b.pickup_location_id
    join locations dl on dl.id = b.dropoff_location_id
    left join lateral (
      select pay.status from payments pay where pay.booking_id = b.id order by pay.created_at desc limit 1
    ) p on true
    where upper(left(replace(b.id::text, '-', ''), 8)) = v_suffix
      and lower(c.email) = lower(trim(p_email));
end;
$$;

comment on function get_booking_by_reference(text, text) is
  'Phase 6. Guest-safe booking lookup by reference + email (case-insensitive), since guest checkout has no auth session for the Phase 0 "customers read own bookings" RLS policy to ever match. SECURITY DEFINER so it can check bookings/customers/payments server-side, but returns only a small non-sensitive summary — no driver license/document fields, no phone. Returns zero rows on ANY mismatch (wrong reference or wrong email) so it cannot be used to test whether a reference exists.';

-- Same audience as available_vehicles(): anonymous visitors (guest
-- checkout) and signed-in users alike must be able to look up a booking.
grant execute on function get_booking_by_reference(text, text) to anon, authenticated;
