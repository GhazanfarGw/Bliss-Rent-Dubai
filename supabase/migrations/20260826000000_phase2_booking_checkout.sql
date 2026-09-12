-- =============================================================================
-- Phase 2 — Booking & Checkout
--
-- WHY THIS MIGRATION IS NEEDED (no new tables — reuses Phase 0/1 schema):
--
-- Creating a real booking touches four tables that customers must NOT be
-- able to write to directly from the browser:
--   - `customers`   — has no public INSERT policy at all (Phase 0).
--   - `drivers`     — customers may only insert a driver row for a booking
--                     they already own (requires an existing auth session).
--   - `payments`    — customers have NO write policy whatsoever; payment
--                     state must only ever be set server-side.
--   - `bookings`    — customers CAN insert their own booking directly, but
--                     that would mean trusting a client-supplied
--                     `total_price`, which Phase 2 explicitly forbids.
--
-- Phase 2 uses GUEST CHECKOUT (no login wall), matching the design Phase 0
-- already left room for: `customers.auth_user_id` is nullable and
-- `customers.email` has a case-insensitive unique index specifically "to
-- support matching a returning guest by email later" (see
-- docs/DATABASE.md). Because there is no auth session in this flow, the
-- normal per-row RLS policies above can't be satisfied by the browser at
-- all for `customers`/`drivers`/`payments` — so booking creation and
-- payment confirmation are both done through two SECURITY DEFINER
-- functions, called ONLY from trusted server code (the create-booking and
-- confirm-payment Edge Functions, which hold the service-role key). They
-- are explicitly NOT reachable from the browser — see the revoke/grant
-- block at the end of this file.
--
-- Both functions do their real work inside a single PL/pgSQL function
-- body, which Postgres treats as one transaction: if anything raises
-- (including the pre-existing `bookings_no_overlap` exclusion constraint
-- from Phase 0 firing on a double-booking race), every effect of the call
-- rolls back atomically. Nothing is ever half-created.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- create_booking
--
-- Takes an ALREADY-COMPUTED price (term/unit_price/total_price). That
-- price is computed server-side, in the create-booking Edge Function, by
-- calling the SAME `resolveTermForDays` / `quoteForDays` TypeScript
-- functions from src/lib/pricing.ts that Phase 1 already built and
-- tested for on-site price display — see
-- supabase/functions/create-booking/logic.ts. This keeps there being ONE
-- authoritative pricing calculation path rather than a second
-- implementation re-derived in SQL. What THIS function guarantees, as the
-- data-integrity backstop regardless of caller: the price can't be
-- negative, the vehicle must actually exist and be `available`, and the
-- booking can't be created if it would overlap another live booking for
-- the same vehicle (the Phase 0 exclusion constraint is what actually
-- makes that atomic and race-safe).
-- ---------------------------------------------------------------------------
create or replace function create_booking(
  p_vehicle_id            uuid,
  p_pickup_location_id    uuid,
  p_dropoff_location_id   uuid,
  p_start_date            date,
  p_end_date              date,
  p_term                  pricing_term,
  p_unit_price            numeric,
  p_total_price           numeric,
  p_currency              text,
  p_customer_full_name    text,
  p_customer_email        text,
  p_customer_phone        text,
  p_driver_full_name      text,
  p_driver_date_of_birth  date,
  p_driver_license_number text,
  p_driver_license_country text,
  p_driver_license_expiry date,
  p_payment_provider      text
)
returns table (
  booking_id        uuid,
  booking_reference text,
  customer_id       uuid,
  driver_id         uuid,
  payment_id        uuid,
  status            booking_status,
  total_price       numeric,
  currency          text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id     uuid;
  v_booking_id      uuid;
  v_driver_id       uuid;
  v_payment_id      uuid;
  v_vehicle_status  vehicle_status;
  v_pickup_active   boolean;
  v_dropoff_active  boolean;
begin
  if p_end_date < p_start_date then
    raise exception 'end date must not be before start date' using errcode = '22023';
  end if;
  if p_unit_price < 0 or p_total_price < 0 then
    raise exception 'price must not be negative' using errcode = '22023';
  end if;
  if p_customer_full_name is null or btrim(p_customer_full_name) = '' then
    raise exception 'customer full name is required' using errcode = '22023';
  end if;
  if p_customer_email is null or btrim(p_customer_email) = '' then
    raise exception 'customer email is required' using errcode = '22023';
  end if;

  -- Lock the vehicle row so a concurrent status change (e.g. an admin
  -- pulling it into maintenance) can't interleave with this check.
  -- NOTE: `vehicles.status` must be qualified here — this function's
  -- RETURNS TABLE declares an OUT column also named `status`, which
  -- would otherwise shadow the bare column name and raise "ambiguous".
  select vehicles.status into v_vehicle_status from vehicles where id = p_vehicle_id for update;
  if not found then
    raise exception 'vehicle not found' using errcode = 'PGRST'; -- caught by message text in the Edge Function
  end if;
  if v_vehicle_status <> 'available' then
    raise exception 'vehicle is not available for booking';
  end if;

  select is_active into v_pickup_active from locations where id = p_pickup_location_id;
  if not found or not v_pickup_active then
    raise exception 'pickup location is not valid';
  end if;
  select is_active into v_dropoff_active from locations where id = p_dropoff_location_id;
  if not found or not v_dropoff_active then
    raise exception 'drop-off location is not valid';
  end if;

  -- Find-or-create the guest customer, matched by the case-insensitive
  -- email unique index already in place from Phase 0.
  insert into customers (full_name, email, phone)
  values (p_customer_full_name, p_customer_email, p_customer_phone)
  on conflict (lower(email)) do update
    set full_name = excluded.full_name,
        phone = coalesce(excluded.phone, customers.phone)
  returning id into v_customer_id;

  -- The actual double-booking guard: `bookings_no_overlap` (Phase 0) is a
  -- gist exclusion constraint on (vehicle_id, daterange(...)) for any
  -- non-cancelled booking. If another booking for this vehicle/date-range
  -- was committed after our search but before this insert, Postgres
  -- raises exclusion_violation (SQLSTATE 23P01) right here, and every
  -- change this function made (including the customer upsert above) rolls
  -- back automatically. See supabase/functions/create-booking/logic.ts
  -- for how that's turned into a clean "someone else just booked this
  -- vehicle" message for the customer.
  insert into bookings (
    customer_id, vehicle_id, pickup_location_id, dropoff_location_id,
    term, start_date, end_date, status, total_price, currency
  ) values (
    v_customer_id, p_vehicle_id, p_pickup_location_id, p_dropoff_location_id,
    p_term, p_start_date, p_end_date, 'pending_payment', p_total_price, p_currency
  )
  returning id into v_booking_id;

  insert into drivers (
    booking_id, full_name, date_of_birth, license_number, license_country, license_expiry
  ) values (
    v_booking_id, p_driver_full_name, p_driver_date_of_birth, p_driver_license_number,
    p_driver_license_country, p_driver_license_expiry
  )
  returning id into v_driver_id;

  insert into payments (booking_id, amount, currency, status, provider)
  values (v_booking_id, p_total_price, p_currency, 'pending', p_payment_provider)
  returning id into v_payment_id;

  return query
    select
      v_booking_id,
      'BLS-' || upper(left(replace(v_booking_id::text, '-', ''), 8)),
      v_customer_id,
      v_driver_id,
      v_payment_id,
      'pending_payment'::booking_status,
      p_total_price,
      p_currency;
end;
$$;

comment on function create_booking is
  'Phase 2 booking creation. SECURITY DEFINER so it can write customers/bookings/drivers/payments for a guest (no auth session) in one atomic transaction. Price arrives pre-computed from the single authoritative TS pricing path (src/lib/pricing.ts, called server-side) — this function never re-derives it, it only guards against a negative/malformed value. NOT reachable from the browser — see revoke/grant below.';

-- ---------------------------------------------------------------------------
-- confirm_payment
--
-- Atomically resolves a pending payment to 'paid' or 'failed' and, on
-- success, advances the booking from 'pending_payment' to 'confirmed'.
-- Idempotent by design: calling it again for a payment that's already
-- resolved just returns the existing result rather than erroring or
-- double-processing — this is what makes an accidental duplicate submit
-- (double-click, resubmitted form) harmless. See
-- supabase/functions/confirm-payment/logic.ts for how the pass/fail
-- OUTCOME itself is decided (a clearly-labeled TEST ONLY simulated
-- provider, pending a real payment gateway integration).
-- ---------------------------------------------------------------------------
create or replace function confirm_payment(
  p_payment_id         uuid,
  p_outcome            payment_status,
  p_provider_reference text
)
returns table (
  payment_id      uuid,
  booking_id      uuid,
  payment_status  payment_status,
  booking_status  booking_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id       uuid;
  v_current_status   payment_status;
  v_resulting_booking booking_status;
begin
  if p_outcome not in ('paid', 'failed') then
    raise exception 'outcome must be paid or failed';
  end if;

  -- NOTE: qualified with `payments.` — this function's RETURNS TABLE
  -- declares an OUT column named `booking_id`, which would otherwise
  -- shadow the bare column name and raise "ambiguous".
  select payments.booking_id, payments.status into v_booking_id, v_current_status
  from payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'payment not found';
  end if;

  -- Idempotency: a payment already resolved just returns its current
  -- state again instead of erroring or re-applying side effects.
  if v_current_status in ('paid', 'failed') then
    select b.status into v_resulting_booking from bookings b where b.id = v_booking_id;
    return query select p_payment_id, v_booking_id, v_current_status, v_resulting_booking;
    return;
  end if;

  update payments
  set status = p_outcome,
      provider_reference = p_provider_reference,
      paid_at = case when p_outcome = 'paid' then now() else null end
  where id = p_payment_id;

  if p_outcome = 'paid' then
    update bookings
    set status = 'confirmed'
    where id = v_booking_id and status = 'pending_payment';
  end if;

  select b.status into v_resulting_booking from bookings b where b.id = v_booking_id;

  return query select p_payment_id, v_booking_id, p_outcome, v_resulting_booking;
end;
$$;

comment on function confirm_payment is
  'Phase 2 payment confirmation. SECURITY DEFINER because payments has no client write policy at all (Phase 0, by design). Idempotent — a repeat call for an already-resolved payment is a no-op that returns the existing state. NOT reachable from the browser — see revoke/grant below.';

-- ---------------------------------------------------------------------------
-- Lock both functions down to server-side callers only.
--
-- Postgres grants EXECUTE on a new function to PUBLIC by default, which
-- would otherwise mean any anon/authenticated browser client could call
-- supabase.rpc('create_booking', ...) directly — completely undermining
-- "never trust a price/availability value from the browser", since they
-- could just pass any total_price they liked. These two functions are
-- reachable ONLY through the create-booking / confirm-payment Edge
-- Functions, which authenticate to Postgres using the service-role key.
-- ---------------------------------------------------------------------------
revoke execute on function create_booking(
  uuid, uuid, uuid, date, date, pricing_term, numeric, numeric, text,
  text, text, text, text, date, text, text, date, text
) from public, anon, authenticated;

revoke execute on function confirm_payment(uuid, payment_status, text) from public, anon, authenticated;

grant execute on function create_booking(
  uuid, uuid, uuid, date, date, pricing_term, numeric, numeric, text,
  text, text, text, text, date, text, text, date, text
) to service_role;

grant execute on function confirm_payment(uuid, payment_status, text) to service_role;
