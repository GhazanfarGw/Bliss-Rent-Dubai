-- =============================================================================
-- Manage Booking — single-field lookup (booking reference OR vehicle plate)
--
-- Follow-up request from the owner, made directly in chat after Phase 7
-- (booking reassignment) went to production: replace ManageBookingPage's
-- reference+email pairing with a single field that accepts EITHER the
-- booking reference OR the vehicle's plate number, and merge the separate
-- /extend-rental page into this same page (shown inline once a booking is
-- found). This migration only adds the new lookup function the merged page
-- needs; nothing about Extend Rental's own submission engine changes.
--
-- DELIBERATE SECURITY TRADE-OFF — READ BEFORE TOUCHING THIS FUNCTION:
--   Every other guest-facing lookup in this project (get_booking_by_reference,
--   verify_booking_for_extension) requires TWO values to match together
--   specifically so a single leaked or guessed value can never be used
--   alone to pull up someone else's booking. This function is a deliberate,
--   explicit exception: the owner was shown that trade-off directly
--   (reference alone, or plate alone, is now sufficient — a stranger who
--   sees a physical plate, or who obtains a reference some other way,
--   could look up the FULL booking detail below, including the customer's
--   name and the amount paid) and chose it anyway, in favor of a simpler
--   one-field form. Do not "fix" this back to a paired check without
--   checking with the owner first — it was not an oversight.
--
--   The exposure is bounded in practice: plate numbers are never shown on
--   any PUBLIC page in this codebase (only on the admin dashboard and to
--   the customer who already has the car), and a booking reference is an
--   8-character hex string derived from a random UUID (32 bits) — not
--   sequential, not guessable by incrementing. But it is still a real,
--   accepted reduction in protection compared to the rest of this project,
--   and should be described as such in the completion report.
--
-- REUSES, UNCHANGED: bookings, vehicles, customers, locations, payments —
-- no schema change, no RLS change on any existing table. This is one new
-- read-only SECURITY DEFINER function, following the exact shape and
-- "zero rows on no match" convention already used by
-- get_booking_by_reference() (Phase 6) — the only difference is what it
-- takes as input and matches against.
-- =============================================================================

create or replace function lookup_booking_for_customer(p_query text)
returns table (
  booking_id           uuid,
  booking_reference    text,
  booking_status       booking_status,
  start_date           date,
  end_date             date,
  total_price          numeric,
  currency             text,
  vehicle_make         text,
  vehicle_model        text,
  vehicle_plate        text,
  pickup_location_name text,
  dropoff_location_name text,
  customer_name        text,
  payment_status       payment_status,
  created_at           timestamptz
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

  -- Normalize once: strip spaces/dashes-in-plate noise isn't needed since
  -- plates in this fleet are plain alphanumerics, but we do strip spaces
  -- (e.g. "78 456") and uppercase for a case-insensitive match either way.
  v_normalized := upper(replace(btrim(p_query), ' ', ''));
  -- Same reference-suffix derivation as get_booking_by_reference /
  -- verify_booking_for_extension: strip an optional 'BLS-' prefix so a
  -- customer can paste the reference exactly as displayed.
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
      v.make,
      v.model,
      v.plate_number,
      pl.name,
      dl.name,
      c.full_name,
      pay.status,
      b.created_at
    from bookings b
    join customers c on c.id = b.customer_id
    join vehicles v on v.id = b.vehicle_id
    join locations pl on pl.id = b.pickup_location_id
    join locations dl on dl.id = b.dropoff_location_id
    left join lateral (
      select p2.status from payments p2 where p2.booking_id = b.id order by p2.created_at desc limit 1
    ) pay on true
    where upper(left(replace(b.id::text, '-', ''), 8)) = v_ref_suffix
       or upper(replace(v.plate_number, ' ', '')) = v_normalized
    order by
      -- An exact reference match always wins over a coincidental plate
      -- match (can't actually happen given the different formats, but
      -- keeps the ordering intentional rather than accidental).
      (upper(left(replace(b.id::text, '-', ''), 8)) = v_ref_suffix) desc,
      -- When the query matched a PLATE and that vehicle has more than one
      -- booking in its history, prefer the one most relevant to "check my
      -- booking status right now": currently active, then the soonest
      -- upcoming confirmed booking, then just the most recent overall.
      (b.status = 'active') desc,
      (b.status = 'confirmed') desc,
      b.created_at desc
    limit 1;
end;
$$;

comment on function lookup_booking_for_customer is
  'Guest-safe booking lookup by EITHER booking reference OR vehicle plate number alone (single field) — see this migration''s header for the deliberate, owner-approved security trade-off versus this project''s usual paired-value convention. Returns the same non-sensitive-but-full summary as get_booking_by_reference (customer name, price, payment status — no license/ID document fields, no phone). Zero rows when neither the reference nor the plate matches anything.';

-- Same audience as get_booking_by_reference()/available_vehicles(): guest
-- checkout has no session, so anonymous visitors and signed-in users alike
-- must be able to call this directly (read-only, no Edge Function needed).
grant execute on function lookup_booking_for_customer(text) to anon, authenticated;
