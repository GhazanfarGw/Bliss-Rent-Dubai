-- =============================================================================
-- Phase 1 — Customer Website & Vehicle Search
--
-- WHY THIS MIGRATION IS NEEDED (no other schema changes were made):
--
-- Vehicle availability for a date range can only be computed correctly by
-- checking for overlapping rows in `bookings`. But `bookings` is
-- intentionally NOT publicly readable (Phase 0 RLS: a customer may only
-- read their OWN bookings, and an anonymous visitor browsing the site
-- before logging in can read none). That's correct and must not change —
-- booking records reference other customers and must stay private.
--
-- That means the browser cannot compute availability itself by querying
-- `bookings` directly (RLS would return an empty/partial set, and even a
-- partial view would leak the existence of other customers' bookings).
-- The fix is a single `SECURITY DEFINER` function that runs with elevated
-- privileges INSIDE THE DATABASE, checks `bookings` internally, and
-- returns only vehicle rows — the same public columns already exposed by
-- the existing `vehicles` table's public read policy. No booking,
-- customer, payment, or driver data is returned by this function.
--
-- This keeps the "no hardcoded availability in React" requirement
-- satisfiable at all: the availability check now happens in the
-- database, in one place, and the frontend just calls it.
-- =============================================================================

create or replace function available_vehicles(p_start_date date, p_end_date date)
returns setof vehicles
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if p_start_date is null or p_end_date is null then
    raise exception 'p_start_date and p_end_date are required';
  end if;
  if p_end_date < p_start_date then
    raise exception 'p_end_date must not be before p_start_date';
  end if;

  return query
    select v.*
    from vehicles v
    where v.status = 'available'
      and not exists (
        select 1
        from bookings b
        where b.vehicle_id = v.id
          and b.status <> 'cancelled'
          and daterange(b.start_date, b.end_date, '[]')
              && daterange(p_start_date, p_end_date, '[]')
      )
    order by v.make, v.model;
end;
$$;

comment on function available_vehicles(date, date) is
  'Phase 1 search. Returns vehicles with status = available and no overlapping non-cancelled booking for the given date range. SECURITY DEFINER so it can check the private bookings table internally, but it returns ONLY vehicle rows — the same public columns already readable via the vehicles table''s own RLS policy. Never exposes booking, customer, payment, or driver data.';

-- Anonymous visitors must be able to search before logging in, and signed-in
-- customers too — same audience as the existing public vehicle-browsing
-- policies from Phase 0.
grant execute on function available_vehicles(date, date) to anon, authenticated;
