-- =============================================================================
-- Phase 14 — Reserved-copy business model
--
-- Approved business flow (see claude/phase-14-business-model-reserved-copy-
-- audit-2026-09-07.md and the owner's follow-up decisions, 2026-09-07):
--   Master Car Listing -> Customer Books + Pays -> Automatic Reserved Copy
--   -> Admin sources actual car -> Admin confirms plate
--       -> NEW plate: Reserved copy becomes new physical inventory (+1)
--       -> EXISTING plate: reuse that physical vehicle, retire the copy
--   -> Customer receives confirmed plate via Email + WhatsApp -> Delivery.
--
-- ADDITIVE ONLY. No table/column/constraint is dropped, no existing row is
-- rewritten beyond two new nullable/defaulted columns on `vehicles` and
-- three new nullable/defaulted columns on `booking_notifications`. Every
-- pre-existing row becomes `is_master_listing = true` by the column's own
-- default, which is exactly correct for the 31 vehicles that exist today
-- and for every booking already pointing at one of them directly (see the
-- note on legacy bookings below).
--
-- WHAT THIS MIGRATION DOES NOT TOUCH:
--   - bookings_no_overlap (Phase 0) — never altered, weakened, or bypassed.
--     Every vehicle_id/plate change below happens through a plain UPDATE
--     that this constraint still polices atomically.
--   - pricing / vehicle_images — no schema change. Reserved copies
--     deliberately do NOT get their own pricing/image rows (avoids a
--     second source of truth for a master listing's price/photos); the
--     application layer resolves both via `master_vehicle_id` when set.
--   - Existing RLS policies, is_admin()/is_super_admin(), audit_logs,
--     booking_status_history, handle_booking_status_change(), Stripe
--     payment/webhook functions, extension/verification functions — all
--     unchanged.
--   - The 4 existing booking_notifications.notification_type values and
--     their delivery pipeline (deliverExtensionNotificationEmails) — left
--     completely alone; 'plate_confirmed' is delivered by a separate,
--     new function (see supabase/functions/_shared/email/
--     deliverPlateConfirmedNotification.ts) precisely so this migration
--     introduces zero behavioral change to the existing extension/
--     reassignment email flow.
--
-- LEGACY BOOKINGS (created before this migration): their `vehicle_id`
-- already points directly at what is now flagged `is_master_listing =
-- true` — that vehicle row already carries a real (if placeholder-style,
-- e.g. TEMP-LUX-01) plate, so there is no "unconfirmed Reserved copy" to
-- confirm a plate on. admin_confirm_booking_vehicle() below explicitly
-- detects and rejects this case with a clear message rather than
-- guessing or silently reinterpreting old data — see its own comment.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. vehicles — master listing vs. Reserved copy.
-- ---------------------------------------------------------------------------
alter table vehicles
  add column is_master_listing boolean not null default true,
  add column master_vehicle_id uuid references vehicles (id);

alter table vehicles
  add constraint vehicles_master_listing_shape_check
  check ((is_master_listing and master_vehicle_id is null) or (not is_master_listing));

create index vehicles_master_vehicle_id_idx on vehicles (master_vehicle_id);

comment on column vehicles.is_master_listing is
  'true = the public, always-searchable listing customers browse and book (Phase 14). false = a booking-specific "Reserved copy" cloned from a master listing at booking time -- never shown in search (available_vehicles() only ever returns is_master_listing = true rows), capacity 1, governed by bookings_no_overlap exactly like every vehicle row always has been. Every pre-existing row defaults to true (correct: they are all master listings today).';
comment on column vehicles.master_vehicle_id is
  'Set only on a Reserved copy (is_master_listing = false): the master listing it was cloned from at booking time. Used to resolve pricing/images for a Reserved-copy booking without duplicating those rows -- see vehicles_master_listing_shape_check.';

-- ---------------------------------------------------------------------------
-- 2. booking_notifications — widen the type list for 'plate_confirmed' and
-- add WhatsApp delivery tracking, additive and separate from the existing
-- (email) status/sent_at columns, which are left exactly as they are.
--
-- whatsapp_status defaults to 'not_applicable' -- NOT 'pending_delivery' --
-- for every existing/other notification_type, because WhatsApp was never
-- requested for vehicle_reassigned/extension_approved/etc (Phase 9E is
-- Email-only, unchanged here); only a freshly-inserted 'plate_confirmed'
-- row is explicitly given 'pending_delivery' by admin_confirm_booking_
-- vehicle() below. This avoids inventing a new WhatsApp obligation for
-- notification types the owner never asked to add it to.
-- ---------------------------------------------------------------------------
alter table booking_notifications
  drop constraint if exists booking_notifications_notification_type_check;

alter table booking_notifications
  add constraint booking_notifications_notification_type_check
  check (notification_type in (
    'vehicle_reassigned', 'extension_approved', 'extension_rejected',
    'extension_conflict_pending_review', 'plate_confirmed'
  ));

alter table booking_notifications
  add column whatsapp_status text not null default 'not_applicable'
    check (whatsapp_status in ('not_applicable', 'pending_delivery', 'sent', 'failed', 'not_configured')),
  add column whatsapp_dispatched_at timestamptz,
  add column whatsapp_sent_at timestamptz;

comment on column booking_notifications.whatsapp_status is
  'Phase 14. ''not_applicable'' for every notification type except plate_confirmed (WhatsApp was only requested for the plate-confirmation step of the business flow). ''pending_delivery'' until a dispatch attempt runs; ''not_configured'' if no WhatsApp provider is set up yet (see dispatchPlateConfirmedWhatsapp.ts -- this project has no Twilio/Meta Cloud API/WhatsApp Business integration today, and none is invented here); ''sent''/''failed'' once a real provider is wired up in a future phase.';

-- ---------------------------------------------------------------------------
-- 3. available_vehicles(start, end) — master listings stay searchable
-- regardless of any Reserved-copy bookings against them. Same signature,
-- same SECURITY DEFINER/grant shape, same input validation as Phase 1 --
-- only the WHERE clause changes. Reserved copies (is_master_listing =
-- false) are never returned here; they are not shown to customers.
--
-- The date parameters are still required and validated (a caller passing
-- a malformed range still gets the same clear error as before), but no
-- longer used to filter results -- under the new model a master listing's
-- own row is never itself booked (see create_booking below), so there is
-- nothing on it left to overlap-check. This is not "unlimited
-- availability with no protection": the real scarcity check on an actual
-- physical vehicle now happens later, at plate-confirmation time (see
-- admin_confirm_booking_vehicle), and bookings_no_overlap continues to
-- protect every physical/Reserved-copy vehicle row exactly as before.
-- ---------------------------------------------------------------------------
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
      and v.is_master_listing = true
    order by v.make, v.model;
end;
$$;

comment on function available_vehicles(date, date) is
  'Phase 14: master listings (is_master_listing = true) with status = available are always returned, regardless of any Reserved-copy bookings made against them -- a master listing is never itself booked under the new model, so there is nothing to overlap-check here. Reserved copies are never returned (not customer-facing). Date arguments are still required/validated for a stable API, but no longer filter results. SECURITY DEFINER so it can be granted to anon/authenticated without exposing bookings directly -- unchanged from Phase 1.';

-- ---------------------------------------------------------------------------
-- 4. create_booking(...) — SAME signature as the live checkout-v2 version
-- (20260920000000_checkout_v2_names_phone_and_stripe.sql: 18 original
-- params plus 5 trailing defaulted params for first/last name + driver
-- phone). No caller change needed in create-booking/index.ts or logic.ts.
-- Only the body changes: the incoming vehicle must be a master listing; a
-- fresh, booking-specific Reserved copy is cloned from it (same make/
-- model/year/transmission/seats/category, a freshly generated unique
-- placeholder plate, is_master_listing = false, master_vehicle_id set),
-- and the new booking row is created against THAT copy's id -- never the
-- master's. Everything else (customer upsert incl. first/last name,
-- driver incl. first/last name + phone, payment, bookings_no_overlap) is
-- byte-for-byte the same logic as the live checkout-v2 version.
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
  p_payment_provider      text,
  p_customer_first_name   text default null,
  p_customer_last_name    text default null,
  p_driver_first_name     text default null,
  p_driver_last_name      text default null,
  p_driver_phone          text default null
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
  v_customer_id       uuid;
  v_booking_id        uuid;
  v_driver_id         uuid;
  v_payment_id        uuid;
  v_master             vehicles%rowtype;
  v_pickup_active     boolean;
  v_dropoff_active    boolean;
  v_reserved_plate    text;
  v_reserved_vehicle_id uuid;
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

  -- Lock the MASTER LISTING row so a concurrent status change (e.g. an
  -- admin pulling it into maintenance) can't interleave with this check.
  select * into v_master from vehicles where id = p_vehicle_id for update;
  if not found then
    raise exception 'vehicle not found' using errcode = 'PGRST';
  end if;
  if not v_master.is_master_listing then
    raise exception 'This vehicle is a Reserved copy, not a bookable master listing.';
  end if;
  if v_master.status <> 'available' then
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
  insert into customers (full_name, email, phone, first_name, last_name)
  values (p_customer_full_name, p_customer_email, p_customer_phone, p_customer_first_name, p_customer_last_name)
  on conflict (lower(email)) do update
    set full_name = excluded.full_name,
        phone = coalesce(excluded.phone, customers.phone),
        first_name = coalesce(excluded.first_name, customers.first_name),
        last_name = coalesce(excluded.last_name, customers.last_name)
  returning id into v_customer_id;

  -- Phase 14: auto-create this booking's Reserved copy from the master
  -- listing. plate_number must be non-null/unique at insert time (the
  -- column's own constraints are unchanged) -- a freshly generated,
  -- globally-unique placeholder ("no real plate confirmed yet") is used
  -- rather than relaxing that constraint. Never shown to the customer
  -- (bookingEmailData.ts only ever reads make/model, never plate_number).
  v_reserved_plate := 'RSV-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 10));

  insert into vehicles (
    category_id, make, model, model_year, transmission, seats,
    plate_number, status, is_master_listing, master_vehicle_id
  ) values (
    v_master.category_id, v_master.make, v_master.model, v_master.model_year,
    v_master.transmission, v_master.seats, v_reserved_plate, 'available',
    false, v_master.id
  )
  returning id into v_reserved_vehicle_id;

  -- The actual double-booking guard: `bookings_no_overlap` (Phase 0) still
  -- governs this insert, now scoped to the freshly-created Reserved
  -- copy's own id (which, being brand new, can never already have another
  -- booking against it) -- the exclusion constraint is exactly as
  -- protective as before, just correctly scoped to the physical unit
  -- instead of the always-bookable master listing.
  insert into bookings (
    customer_id, vehicle_id, pickup_location_id, dropoff_location_id,
    term, start_date, end_date, status, total_price, currency
  ) values (
    v_customer_id, v_reserved_vehicle_id, p_pickup_location_id, p_dropoff_location_id,
    p_term, p_start_date, p_end_date, 'pending_payment', p_total_price, p_currency
  )
  returning id into v_booking_id;

  insert into drivers (
    booking_id, full_name, date_of_birth, license_number, license_country, license_expiry,
    first_name, last_name, phone
  ) values (
    v_booking_id, p_driver_full_name, p_driver_date_of_birth, p_driver_license_number,
    p_driver_license_country, p_driver_license_expiry,
    p_driver_first_name, p_driver_last_name, p_driver_phone
  )
  returning id into v_driver_id;

  insert into payments (booking_id, amount, currency, status, provider)
  values (v_booking_id, p_total_price, p_currency, 'pending', p_payment_provider)
  returning id into v_payment_id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (
    null, 'reserved_copy_created', 'vehicles', v_reserved_vehicle_id,
    jsonb_build_object('master_vehicle_id', v_master.id, 'booking_id', v_booking_id)
  );

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

comment on function create_booking(
  uuid, uuid, uuid, date, date, pricing_term, numeric, numeric, text,
  text, text, text, text, date, text, text, date, text,
  text, text, text, text, text
) is
  'Phase 14: unchanged signature (same 18 params + the checkout-v2 first/last-name/phone trailing params), unchanged pricing/customer/driver/payment logic. The one behavioral change: the booking is created against a freshly-cloned, booking-specific Reserved copy of the master listing (is_master_listing = false, master_vehicle_id set, a generated unique placeholder plate) rather than against the master listing''s own row -- so the master listing itself is never consumed by a booking and stays searchable/bookable for any other (even overlapping) date range. bookings_no_overlap continues to be the real double-booking guard, now correctly scoped to the Reserved copy.';

-- Re-assert the existing lockdown against the CURRENT (checkout-v2) 23-arg
-- signature -- create or replace does not change grants, but stating this
-- explicitly documents the invariant this migration must not weaken: still
-- service_role only, never anon/authenticated.
revoke execute on function create_booking(
  uuid, uuid, uuid, date, date, pricing_term, numeric, numeric, text,
  text, text, text, text, date, text, text, date, text,
  text, text, text, text, text
) from public, anon, authenticated;
grant execute on function create_booking(
  uuid, uuid, uuid, date, date, pricing_term, numeric, numeric, text,
  text, text, text, text, date, text, text, date, text,
  text, text, text, text, text
) to service_role;

-- ---------------------------------------------------------------------------
-- 5. admin_confirm_booking_vehicle — the new Admin "Confirm Vehicle"
-- action. Super-Admin-only (matches every other booking-mutating RPC:
-- admin_cancel_booking / admin_start_rental / admin_mark_returned /
-- admin_confirm_booking_payment), SECURITY DEFINER, row-locked,
-- idempotent, audit-logged -- same shape as Phase 11's RPCs.
--
-- Only usable on a booking whose CURRENT vehicle is a genuine Reserved
-- copy (is_master_listing = false) -- i.e. a booking created after this
-- migration. A legacy (pre-Phase-14) booking's vehicle_id already points
-- directly at a master-listing row that already carries a real plate --
-- there is no unconfirmed Reserved copy to confirm anything on, so this
-- is rejected with a clear message rather than silently reinterpreted.
--
-- DECISION 1 (owner-approved, 2026-09-07) -- OPTION B for an existing
-- plate: identify the existing physical vehicle by its real plate,
-- safely verify it against THIS booking's own date range, atomically
-- repoint bookings.vehicle_id at it, and retire (never delete) the
-- now-unused Reserved copy. This reuses the same "lock candidate row,
-- re-check for a date-range conflict, then a plain UPDATE that
-- bookings_no_overlap still polices atomically" discipline as Phase 7's
-- resolve_extension_conflict(), and records the change in
-- vehicle_reassignments exactly like that function does.
-- ---------------------------------------------------------------------------
create or replace function admin_confirm_booking_vehicle(
  p_booking_id   uuid,
  p_plate_number text,
  p_note         text default null
)
returns table (
  booking_id                 uuid,
  vehicle_id                 uuid,
  plate_number               text,
  is_new_physical_vehicle    boolean,
  changed                    boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking          bookings%rowtype;
  v_current_vehicle  vehicles%rowtype;
  v_target_vehicle   vehicles%rowtype;
  v_normalized_plate text;
  v_result_vehicle_id uuid;
  v_is_new           boolean;
begin
  if not is_super_admin() then
    raise exception 'Only a Super Admin can confirm a booking''s vehicle.';
  end if;

  if p_plate_number is null or btrim(p_plate_number) = '' then
    raise exception 'A plate number is required.';
  end if;
  v_normalized_plate := upper(btrim(p_plate_number));

  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status not in ('confirmed', 'active') then
    raise exception 'A vehicle can only be confirmed for a paid booking (current status: %).', v_booking.status;
  end if;

  select * into v_current_vehicle from vehicles where id = v_booking.vehicle_id for update;
  if not found then
    raise exception 'The vehicle linked to this booking could not be found.';
  end if;

  if v_current_vehicle.is_master_listing then
    raise exception 'This booking is linked directly to a master listing and predates the Reserved-copy workflow -- there is no Reserved copy to confirm a plate on.';
  end if;

  -- Idempotent: already confirmed with exactly this plate.
  if upper(v_current_vehicle.plate_number) = v_normalized_plate then
    return query select v_booking.id, v_current_vehicle.id, v_current_vehicle.plate_number, false, false;
    return;
  end if;

  -- Does an existing vehicle row already carry this plate?
  -- NOTE: `plate_number` must be qualified as `vehicles.plate_number` here --
  -- this function's own RETURNS TABLE declares an OUT parameter also named
  -- `plate_number`, which otherwise shadows the bare column name and raises
  -- "column reference is ambiguous" (42702), exactly like the pre-existing
  -- create_booking/confirm_payment functions already have to work around.
  select * into v_target_vehicle from vehicles where upper(vehicles.plate_number) = v_normalized_plate for update;

  if not found then
    -- NEW PLATE: this Reserved copy becomes the new physical vehicle.
    -- Inventory effectively +1: one more vehicles row now carries a real,
    -- non-placeholder plate.
    update vehicles set plate_number = v_normalized_plate where id = v_current_vehicle.id;

    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (auth.uid(), 'booking_vehicle_plate_confirmed_new', 'vehicles', v_current_vehicle.id,
      jsonb_build_object('booking_id', v_booking.id, 'plate_number', v_normalized_plate, 'note', p_note));

    v_result_vehicle_id := v_current_vehicle.id;
    v_is_new := true;
  else
    -- NOTE: v_target_vehicle.is_master_listing is deliberately NOT checked
    -- here. Every one of the 31 vehicles that existed before this
    -- migration is flagged is_master_listing = true (the column's own
    -- default, preserving their legacy searchability/bookability) even
    -- though every one of them is *also* today's real, physical car with
    -- a real plate -- there was no Reserved-copy distinction before this
    -- migration. Decision 1 (owner-approved, 2026-09-07) requires
    -- identifying "the existing physical vehicle by its real plate"
    -- across ALL vehicle rows without exception ("A real physical vehicle
    -- must have ONE authoritative vehicle row and ONE real plate
    -- number") -- rejecting a match just because that row is *also* a
    -- master listing would make it impossible to ever assign a booking
    -- to any of today's actual fleet vehicles by their real plate, which
    -- is the single most common case in practice. Repointing a booking's
    -- vehicle_id at a master-listing row does not stop that row from
    -- remaining searchable/bookable (available_vehicles() and
    -- create_booking() only ever look at is_master_listing/status, never
    -- at whether some other booking's vehicle_id happens to point here
    -- too) -- and bookings_no_overlap plus the date-range check just
    -- below still guarantee the same real plate is never handed to two
    -- overlapping bookings, regardless of this flag.

    -- EXISTING PLATE: safely verify the existing physical vehicle is free
    -- for THIS booking's own date range before touching anything.
    -- NOTE: `vehicle_id` must be qualified as `bookings.vehicle_id` here --
    -- this function's own RETURNS TABLE declares an OUT parameter also
    -- named `vehicle_id`, which otherwise shadows the bare column name and
    -- raises the same "column reference is ambiguous" (42702) as above.
    if exists (
      select 1 from bookings
      where bookings.vehicle_id = v_target_vehicle.id
        and id <> v_booking.id
        and status <> 'cancelled'
        and daterange(start_date, end_date, '[]') && daterange(v_booking.start_date, v_booking.end_date, '[]')
    ) then
      raise exception 'Vehicle % is already assigned to another active booking for an overlapping date range. Choose a different plate or resolve that conflict first.', v_normalized_plate;
    end if;

    -- The actual double-booking guard: bookings_no_overlap still governs
    -- this UPDATE. A genuine last-moment race raises 23P01 here and the
    -- whole transaction rolls back atomically -- nothing is left
    -- half-changed.
    update bookings set vehicle_id = v_target_vehicle.id where id = v_booking.id;

    insert into vehicle_reassignments (booking_id, triggering_extension_id, original_vehicle_id, replacement_vehicle_id, reason, created_by)
    values (v_booking.id, null, v_current_vehicle.id, v_target_vehicle.id, 'Admin confirmed an existing plate for this booking''s Reserved copy', auth.uid());

    -- Retire (never delete) the now-unused Reserved copy -- reuses the
    -- existing vehicle_status enum value, no schema change, no data loss,
    -- and it can never be accidentally offered/reassigned again (it was
    -- never customer-facing to begin with -- is_master_listing = false).
    update vehicles set status = 'retired' where id = v_current_vehicle.id;

    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (auth.uid(), 'booking_vehicle_reassigned_to_existing_plate', 'bookings', v_booking.id,
      jsonb_build_object('previous_reserved_vehicle_id', v_current_vehicle.id, 'existing_vehicle_id', v_target_vehicle.id, 'plate_number', v_normalized_plate, 'note', p_note));

    v_result_vehicle_id := v_target_vehicle.id;
    v_is_new := false;
  end if;

  insert into booking_notifications (booking_id, notification_type, payload, whatsapp_status)
  values (
    v_booking.id, 'plate_confirmed',
    jsonb_build_object(
      'booking_reference', 'BLS-' || upper(left(replace(v_booking.id::text, '-', ''), 8)),
      'plate_number', v_normalized_plate,
      'make', (select make from vehicles where id = v_result_vehicle_id),
      'model', (select model from vehicles where id = v_result_vehicle_id)
    ),
    'pending_delivery'
  );

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (auth.uid(), 'customer_notification_generated', 'booking_notifications', v_booking.id, jsonb_build_object('type', 'plate_confirmed'));

  return query select v_booking.id, v_result_vehicle_id, v_normalized_plate, v_is_new, true;
end;
$$;

comment on function admin_confirm_booking_vehicle is
  'Phase 14. Super-Admin-only, SECURITY DEFINER. Confirms the real plate for a booking''s Reserved copy: a NEW plate renames the Reserved copy in place (inventory +1); an EXISTING plate re-checks that vehicle''s own date-range conflicts, atomically repoints bookings.vehicle_id at it (same lock/re-check/atomic-update discipline as resolve_extension_conflict()), and retires the now-unused Reserved copy. bookings_no_overlap remains the true double-booking guard throughout. Idempotent when called again with the plate already confirmed. Inserts a plate_confirmed booking_notifications row either way, ready for Email + WhatsApp delivery.';

revoke all on function admin_confirm_booking_vehicle(uuid, text, text) from public;
grant execute on function admin_confirm_booking_vehicle(uuid, text, text) to authenticated;
