-- =============================================================================
-- Phase 7 (continued) — Rental Extension & Booking Reassignment
--
-- NOT YET APPLIED TO PRODUCTION. Written and tested locally only.
--
-- This migration EXTENDS the Phase 7 rental-extension system built in
-- 20260902000000_phase7_rental_extensions.sql. It does not rebuild or
-- duplicate anything there — booking_extensions, extension_pricing_settings,
-- check_vehicle_availability_for_extension() all stay exactly as they were;
-- this file adds new columns/tables and REPLACES the two mutating
-- functions (request_booking_extension, confirm_booking_extension_payment)
-- to add two new capabilities on top of the same engine:
--
--   1. A second request channel: a guest-safe, unauthenticated customer
--      self-service submission (verified by booking reference + vehicle
--      number, never auto-approved), landing in the SAME
--      booking_extensions table with the SAME two mutating functions
--      eventually processing it. There is still only ONE extension engine —
--      see the "ONE ENGINE, TWO ENTRY POINTS" note below.
--
--   2. Booking reassignment: when extending the exact vehicle would
--      conflict with a FUTURE booking on that same vehicle, the system no
--      longer just rejects the extension. It looks for a suitable
--      replacement vehicle for the FUTURE booking, reserves it safely, and
--      moves that booking to it — preserving its reference, dates, and
--      other commercial details — so the extending (existing) customer can
--      keep the vehicle already in their possession. See
--      resolve_extension_conflict() below.
--
-- ONE ENGINE, TWO ENTRY POINTS:
--   - WhatsApp/support channel (unchanged in spirit): an admin calls
--     request_booking_extension() directly with a freshly-confirmed
--     request. This still processes immediately (cash resolves on the
--     spot; online is left pending for payment) — nothing about this path
--     changes for the admin who was already using it.
--   - Website self-service channel (new): a guest calls the
--     submit-extension-request Edge Function, which calls
--     submit_extension_request_public() — this ONLY inserts a 'requested'
--     row. It never touches availability, pricing, or bookings.end_date.
--     An admin later reviews it and calls the SAME request_booking_extension()
--     function, passing p_existing_extension_id, to run the SAME
--     availability/conflict/pricing/payment logic against that row instead
--     of inserting a new one. Two doors into one room.
--
-- PENALTY POLICY — DELIBERATELY LEFT UNSET (same "do not guess" shape as
-- extension_pricing_settings from the previous migration, but a wholly
-- separate, independently configurable mechanism — pricing and lateness
-- penalty are two different owner decisions):
--   The owner has not confirmed how a late extension (requested after the
--   original return date has already passed — which this system explicitly
--   ALLOWS, with no "must request within X days" window) should be
--   penalized: a fixed fee, a per-day charge, a percentage of something, or
--   another rule entirely. extension_penalty_settings.policy is seeded NULL.
--   request_booking_extension() refuses to process a LATE extension at all
--   until the owner sets a policy — it never invents one. See
--   src/lib/extensionPenalty.ts for the TypeScript calculation (same "one
--   authoritative calculation path, SQL is only a data-integrity backstop"
--   convention already used for extension pricing).
--
-- NOTIFICATION INFRASTRUCTURE — CONFIRMED ABSENT, DOMAIN STATE ONLY:
--   Audited this codebase for any existing email/SMS/WhatsApp-SENDING
--   integration (as opposed to WhatsApp as a manual human support channel,
--   which is unrelated). None exists: ContactPage.tsx's own comment says
--   "there is no email backend to actually deliver it to yet." Per this
--   phase's explicit instruction not to invent a notification platform,
--   booking_notifications below only records the domain fact that a
--   customer-facing message SHOULD be delivered (e.g. "your vehicle for
--   this booking changed"), with a customer-safe payload and a
--   'pending_delivery' status. Wiring an actual delivery channel (e.g.
--   Resend, already named as the planned provider) is future work,
--   reported as a known limitation in the Phase 7 report.
--
-- BOOKING REASSIGNMENT SAFETY (the part that must never regress):
--   bookings_no_overlap (Phase 0 GIST exclusion constraint) is NEVER
--   altered, weakened, or bypassed here. Every vehicle_id/end_date change
--   in this file happens through a plain UPDATE that constraint still
--   governs — a genuine last-moment race raises Postgres exclusion_violation
--   (23P01) and the ENTIRE transaction (extension + any reassignment
--   already staged within it) rolls back atomically. The replacement
--   vehicle is located, its own row locked, and re-checked for conflicts
--   BEFORE the extending customer's own vehicle is ever touched — see
--   resolve_extension_conflict(). If no safe replacement can be found, the
--   extension is marked 'conflict_unresolved' and NOTHING is changed — no
--   silent decision, no automatic rejection, no vehicle substitution for
--   the extending customer. A human resolves it from the admin dashboard.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- booking_extensions — new columns + widened status.
--
-- extension_status (the old enum: pending/approved/rejected) is left in
-- place, unused, rather than dropped — nothing in this migration depends on
-- removing it, and dropping types is exactly the kind of unnecessary risk
-- to avoid in a migration that cannot be tested against a live database in
-- this sandbox (see the Phase 7 report's disclosed environment limitation).
-- The column itself now uses plain text + a check constraint instead, so
-- two new statuses ('requested', 'conflict_unresolved') can exist without
-- the ALTER TYPE ... ADD VALUE / "unsafe use of new value" transaction
-- restriction that enum type would otherwise run into within this same
-- migration.
-- ---------------------------------------------------------------------------
alter table booking_extensions
  alter column availability_confirmed drop not null,
  alter column support_confirmed_by drop not null,
  alter column processed_by drop not null;

alter table booking_extensions alter column status drop default;
alter table booking_extensions alter column status type text using status::text;
alter table booking_extensions add constraint booking_extensions_status_check
  check (status in ('requested', 'pending', 'approved', 'rejected', 'conflict_unresolved'));
alter table booking_extensions alter column status set default 'pending';

alter table booking_extensions
  add column source                     text not null default 'admin' check (source in ('admin', 'customer')),
  add column is_late                    boolean not null default false,
  add column penalty_amount             numeric check (penalty_amount is null or penalty_amount >= 0),
  add column penalty_policy_used        text check (penalty_policy_used is null or penalty_policy_used in ('fixed_fee', 'per_day', 'percentage')),
  add column conflict_booking_id        uuid references bookings (id),
  add column replacement_vehicle_id     uuid references vehicles (id),
  add column booking_reference_verified text,
  add column vehicle_number_verified    text;

comment on column booking_extensions.source is
  '''admin'' = WhatsApp/support-confirmed request recorded directly by an admin — processed immediately, same as the original Phase 7 build. ''customer'' = self-service "Extend Rental" website submission — status starts ''requested'' and does NOT auto-process; an admin must review it (request_booking_extension(..., p_existing_extension_id => ...)) or explicitly reject it (reject_extension_request()).';
comment on column booking_extensions.is_late is
  'true when, at the moment this extension was actually processed, the original return date had already passed. Requesting late is explicitly ALLOWED — there is no "must request within X days" window — but it may carry a configurable penalty; see extension_penalty_settings.';
comment on column booking_extensions.conflict_booking_id is
  'The FUTURE booking on the same exact vehicle that conflicted with this extension, if any — set whether or not the conflict was successfully resolved. See resolve_extension_conflict().';
comment on column booking_extensions.replacement_vehicle_id is
  'The vehicle the conflicting FUTURE booking (conflict_booking_id) was moved to, if the conflict was resolved. NULL when there was no conflict, or when a conflict is still unresolved.';
comment on column booking_extensions.booking_reference_verified is
  'Recorded only for source = customer: the booking reference the customer typed in, exactly as verified against the SAME booking as vehicle_number_verified. Audit trail for the self-service verification step, not used for any lookup.';

-- ---------------------------------------------------------------------------
-- extension_penalty_settings — singleton config row. See migration header.
-- ---------------------------------------------------------------------------
create table extension_penalty_settings (
  id                smallint primary key default 1 check (id = 1),
  policy            text check (policy is null or policy in ('fixed_fee', 'per_day', 'percentage')),
  fixed_fee_amount  numeric check (fixed_fee_amount is null or fixed_fee_amount >= 0),
  per_day_amount    numeric check (per_day_amount is null or per_day_amount >= 0),
  percentage_rate   numeric check (percentage_rate is null or (percentage_rate >= 0 and percentage_rate <= 100)),
  currency          text not null default 'AED',
  updated_by        uuid references admin_profiles (id),
  updated_at        timestamptz not null default now()
);

comment on table extension_penalty_settings is
  'Singleton (id always 1). policy starts NULL — the owner has not yet confirmed how a late-extension penalty should be calculated (fixed fee / per-day / percentage / something else). Independently configurable from extension_pricing_settings: pricing and lateness penalty are two separate business decisions. See migration header "PENALTY POLICY — DELIBERATELY LEFT UNSET".';

insert into extension_penalty_settings (id) values (1);

alter table extension_penalty_settings enable row level security;

create policy "admins read extension penalty settings" on extension_penalty_settings
  for select using (is_admin());

create policy "super admins update extension penalty settings" on extension_penalty_settings
  for update using (is_super_admin()) with check (is_super_admin());

-- ---------------------------------------------------------------------------
-- vehicle_reassignments — traceability for a Customer-B vehicle change.
-- ---------------------------------------------------------------------------
create table vehicle_reassignments (
  id                      uuid primary key default gen_random_uuid(),
  booking_id              uuid not null references bookings (id) on delete restrict,
  triggering_extension_id uuid references booking_extensions (id) on delete set null,
  original_vehicle_id     uuid not null references vehicles (id) on delete restrict,
  replacement_vehicle_id  uuid not null references vehicles (id) on delete restrict,
  reason                  text not null,
  created_by              uuid not null references admin_profiles (id),
  created_at              timestamptz not null default now()
);

create index vehicle_reassignments_booking_id_idx on vehicle_reassignments (booking_id);

comment on table vehicle_reassignments is
  'Traceability record for booking-reassignment conflict resolution: which FUTURE booking had its physical vehicle changed, from what, to what, and why (see resolve_extension_conflict()). The reassigned booking''s own reference, dates, price, and customer info never change here — only bookings.vehicle_id does, on the bookings row itself.';

alter table vehicle_reassignments enable row level security;

create policy "admins read vehicle reassignments" on vehicle_reassignments
  for select using (is_admin());

-- ---------------------------------------------------------------------------
-- booking_notifications — domain state for a customer message this project
-- has no real send channel for yet. See migration header.
-- ---------------------------------------------------------------------------
create table booking_notifications (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references bookings (id) on delete cascade,
  notification_type  text not null check (notification_type in ('vehicle_reassigned', 'extension_approved', 'extension_rejected', 'extension_conflict_pending_review')),
  status             text not null default 'pending_delivery' check (status in ('pending_delivery', 'sent', 'failed')),
  payload            jsonb not null,
  created_at         timestamptz not null default now(),
  sent_at            timestamptz
);

create index booking_notifications_booking_id_idx on booking_notifications (booking_id);

comment on table booking_notifications is
  'Domain state for a customer notification this project does not yet have a real delivery channel for — confirmed by audit: no email/SMS/WhatsApp-SENDING infrastructure exists anywhere in this codebase as of Phase 7 (WhatsApp today is a manual human support channel only). Every row here is a message that SHOULD be delivered and needs a real integration wired up in a later phase (see the Phase 7 report''s "known limitations"). payload deliberately contains only customer-safe fields (booking reference, vehicle plates, dates, a plain-language reason) — never internal admin notes.';

alter table booking_notifications enable row level security;

create policy "admins read booking notifications" on booking_notifications
  for select using (is_admin());

-- ---------------------------------------------------------------------------
-- verify_booking_for_extension
--
-- Guest-safe verification for the self-service "Extend Rental" flow.
-- Mirrors get_booking_by_reference (Phase 6) exactly: returns ZERO ROWS on
-- ANY mismatch (wrong reference or wrong vehicle number), so it can never
-- be used to probe whether either value alone exists, or to find out which
-- of the two was wrong. Read-only preview only — submit_extension_request_public()
-- re-verifies the same match server-side before creating anything.
-- ---------------------------------------------------------------------------
create or replace function verify_booking_for_extension(p_booking_reference text, p_vehicle_number text)
returns table (
  booking_id           uuid,
  booking_reference    text,
  vehicle_make         text,
  vehicle_model        text,
  vehicle_plate        text,
  current_return_date  date,
  booking_status       booking_status
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_suffix text;
begin
  if p_booking_reference is null or trim(p_booking_reference) = ''
     or p_vehicle_number is null or trim(p_vehicle_number) = '' then
    return;
  end if;

  v_suffix := upper(regexp_replace(trim(p_booking_reference), '^BLS-', '', 'i'));

  return query
    select
      b.id,
      'BLS-' || upper(left(replace(b.id::text, '-', ''), 8)),
      v.make,
      v.model,
      v.plate_number,
      b.end_date,
      b.status
    from bookings b
    join vehicles v on v.id = b.vehicle_id
    where upper(left(replace(b.id::text, '-', ''), 8)) = v_suffix
      and upper(replace(v.plate_number, ' ', '')) = upper(replace(trim(p_vehicle_number), ' ', ''));
end;
$$;

comment on function verify_booking_for_extension is
  'Guest-safe verification step for the self-service Extend Rental flow. Returns zero rows on ANY mismatch (wrong reference or wrong vehicle number) — same indistinguishable-failure shape as get_booking_by_reference. Read-only preview only; the real gate is submit_extension_request_public().';

grant execute on function verify_booking_for_extension(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- submit_extension_request_public
--
-- The customer self-service entry point. Guest-callable ONLY through the
-- submit-extension-request Edge Function (this function is granted to
-- service_role only, same "mutating guest action needs a service-role
-- key, not a direct anon grant" convention as create_booking). Verifies
-- reference + vehicle number with the SAME indistinguishable-failure shape
-- as verify_booking_for_extension, validates the 1-30 day bound, and inserts
-- a 'requested' row — nothing else. Availability, pricing, penalty, and
-- payment are ALL deliberately left for an admin to resolve later via
-- request_booking_extension(..., p_existing_extension_id => ...). There is
-- NO advance-request-window check here on purpose: 1 day before return,
-- 5 days before, or already past the return date are all accepted (the
-- last one is simply flagged is_late for the admin/penalty layer).
-- ---------------------------------------------------------------------------
create or replace function submit_extension_request_public(
  p_booking_reference     text,
  p_vehicle_number        text,
  p_requested_return_date date
)
returns table (
  extension_id uuid,
  status       text,
  is_late      boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suffix         text;
  v_booking        record;
  v_extension_days integer;
  v_is_late        boolean;
  v_extension_id   uuid;
begin
  if p_booking_reference is null or btrim(p_booking_reference) = ''
     or p_vehicle_number is null or btrim(p_vehicle_number) = ''
     or p_requested_return_date is null then
    raise exception 'We could not verify that booking reference and vehicle number together. Please double-check both and try again.';
  end if;

  v_suffix := upper(regexp_replace(trim(p_booking_reference), '^BLS-', '', 'i'));

  select b.* into v_booking
  from bookings b
  join vehicles v on v.id = b.vehicle_id
  where upper(left(replace(b.id::text, '-', ''), 8)) = v_suffix
    and upper(replace(v.plate_number, ' ', '')) = upper(replace(trim(p_vehicle_number), ' ', ''));

  -- Zero rows on ANY mismatch — the exact same wording either way, so a
  -- customer can never tell whether the reference or the vehicle number
  -- was the one that didn't match, and can never use this as an oracle to
  -- probe another customer's booking.
  if not found then
    raise exception 'We could not verify that booking reference and vehicle number together. Please double-check both and try again.';
  end if;

  if v_booking.status not in ('confirmed', 'active') then
    raise exception 'This booking cannot be extended right now (status: %). Please contact support.', v_booking.status;
  end if;

  v_extension_days := p_requested_return_date - v_booking.end_date;
  if v_extension_days < 1 or v_extension_days > 30 then
    raise exception 'Extension length must be between 1 and 30 days (requested %).', v_extension_days;
  end if;

  v_is_late := current_date > v_booking.end_date;

  insert into booking_extensions (
    booking_id, vehicle_id, previous_return_date, requested_return_date, extension_days,
    is_late, status, source, booking_reference_verified, vehicle_number_verified
  ) values (
    v_booking.id, v_booking.vehicle_id, v_booking.end_date, p_requested_return_date, v_extension_days,
    v_is_late, 'requested', 'customer', v_suffix, upper(trim(p_vehicle_number))
  )
  returning id into v_extension_id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (
    null, 'extension_requested', 'booking_extensions', v_extension_id,
    jsonb_build_object(
      'booking_id', v_booking.id, 'vehicle_id', v_booking.vehicle_id, 'source', 'customer',
      'previous_return_date', v_booking.end_date, 'requested_return_date', p_requested_return_date,
      'extension_days', v_extension_days, 'is_late', v_is_late
    )
  );
  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (null, 'extension_customer_verification', 'booking_extensions', v_extension_id, jsonb_build_object('method', 'booking_reference_plus_vehicle_number'));

  return query select v_extension_id, 'requested'::text, v_is_late;
end;
$$;

comment on function submit_extension_request_public is
  'The customer self-service Extend Rental entry point — Edge-Function-mediated (service_role only), same architectural pattern as create_booking: a guest mutation needs a service-role key, not a direct anon grant. Inserts a ''requested'' row ONLY — never checks availability, never computes pricing, never touches bookings.end_date, never auto-approves. No advance-request-window restriction: a late request (past the original return date) is accepted and flagged is_late, not rejected.';

revoke all on function submit_extension_request_public(text, text, date) from public;
grant execute on function submit_extension_request_public(text, text, date) to service_role;

-- ---------------------------------------------------------------------------
-- resolve_extension_conflict — the reassignment engine.
--
-- Internal only (no grant to anon/authenticated — called exclusively from
-- request_booking_extension / confirm_booking_extension_payment, both
-- SECURITY DEFINER, so this runs with the same elevated privileges in the
-- SAME transaction). Given the exact vehicle being extended and its new
-- end date, this either finds no conflict, resolves one by moving a
-- conflicting FUTURE booking to a suitable replacement vehicle, or reports
-- that it cannot safely resolve one — never by touching the extending
-- customer's own vehicle, and never by silently guessing.
-- ---------------------------------------------------------------------------
create or replace function resolve_extension_conflict(
  p_extension_id uuid,
  p_booking_id   uuid,
  p_vehicle_id   uuid,
  p_new_end_date date,
  p_actor_id     uuid
)
returns text -- 'ok' | 'resolved' | 'unresolved'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_end_date  date;
  v_conflict          record;
  v_replacement_id    uuid;
  v_replacement_plate text;
  v_original_plate    text;
begin
  select end_date into v_current_end_date from bookings where id = p_booking_id for update;

  -- Any FUTURE (or otherwise overlapping) non-cancelled booking on the
  -- SAME exact vehicle_id that the extended window would newly collide
  -- with. Never model/category — the exact physical vehicle only.
  select b.* into v_conflict
  from bookings b
  where b.vehicle_id = p_vehicle_id
    and b.id <> p_booking_id
    and b.status <> 'cancelled'
    and daterange(b.start_date, b.end_date, '[]') && daterange(v_current_end_date, p_new_end_date, '[]')
  order by b.start_date
  limit 1
  for update;

  if not found then
    return 'ok';
  end if;

  -- Replacement search: available_vehicles() for the CONFLICTING booking's
  -- own date range (Phase 1's exact overlap+status logic, reused, not
  -- reimplemented), ranked same model first, then same category, then
  -- anything else available. Never the vehicle already in this conflict.
  select v.id into v_replacement_id
  from available_vehicles(v_conflict.start_date, v_conflict.end_date) v
  where v.id <> p_vehicle_id
  order by
    (v.model = (select model from vehicles where id = p_vehicle_id)) desc,
    (v.category_id = (select category_id from vehicles where id = p_vehicle_id)) desc,
    v.id
  limit 1;

  if v_replacement_id is null then
    update booking_extensions set status = 'conflict_unresolved', conflict_booking_id = v_conflict.id
    where id = p_extension_id;

    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (p_actor_id, 'extension_conflict_detected', 'booking_extensions', p_extension_id,
      jsonb_build_object('conflict_booking_id', v_conflict.id, 'resolution', 'no_replacement_vehicle_found'));
    insert into booking_notifications (booking_id, notification_type, payload)
    values (p_booking_id, 'extension_conflict_pending_review', jsonb_build_object(
      'note', 'Your extension request needs manual review by our team before it can be completed.'));

    return 'unresolved';
  end if;

  -- Lock the candidate replacement's own row, then do ONE final,
  -- immediately-before-commit availability re-check on it. The real,
  -- race-safe guarantee is still bookings_no_overlap on the UPDATE below —
  -- this is defense in depth so an already-doomed attempt fails fast with
  -- a clean 'unresolved' instead of a raised exception.
  perform 1 from vehicles where id = v_replacement_id for update;

  if exists (
    select 1 from bookings
    where vehicle_id = v_replacement_id
      and status <> 'cancelled'
      and daterange(start_date, end_date, '[]') && daterange(v_conflict.start_date, v_conflict.end_date, '[]')
  ) then
    update booking_extensions set status = 'conflict_unresolved', conflict_booking_id = v_conflict.id
    where id = p_extension_id;

    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (p_actor_id, 'extension_conflict_detected', 'booking_extensions', p_extension_id,
      jsonb_build_object('conflict_booking_id', v_conflict.id, 'resolution', 'replacement_became_unavailable'));

    return 'unresolved';
  end if;

  select plate_number into v_replacement_plate from vehicles where id = v_replacement_id;
  select plate_number into v_original_plate from vehicles where id = p_vehicle_id;

  -- The actual double-booking guard: bookings_no_overlap still governs this
  -- UPDATE. A genuine last-moment race raises 23P01 here and the whole
  -- calling transaction — including the extending customer's own
  -- not-yet-applied end_date change — rolls back atomically.
  update bookings set vehicle_id = v_replacement_id where id = v_conflict.id;

  insert into vehicle_reassignments (booking_id, triggering_extension_id, original_vehicle_id, replacement_vehicle_id, reason, created_by)
  values (v_conflict.id, p_extension_id, p_vehicle_id, v_replacement_id, 'Existing renter extended rental', p_actor_id);

  insert into booking_notifications (booking_id, notification_type, payload)
  values (
    v_conflict.id, 'vehicle_reassigned',
    jsonb_build_object(
      'booking_reference', 'BLS-' || upper(left(replace(v_conflict.id::text, '-', ''), 8)),
      'original_vehicle_plate', v_original_plate,
      'new_vehicle_plate', v_replacement_plate,
      'start_date', v_conflict.start_date,
      'end_date', v_conflict.end_date,
      'reason', 'The vehicle for this booking has been updated to keep your reservation confirmed. Your dates, price, and booking reference are unchanged.'
    )
  );

  update booking_extensions set conflict_booking_id = v_conflict.id, replacement_vehicle_id = v_replacement_id
  where id = p_extension_id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (p_actor_id, 'extension_conflict_detected', 'booking_extensions', p_extension_id, jsonb_build_object('conflict_booking_id', v_conflict.id));
  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (p_actor_id, 'replacement_vehicle_selected', 'bookings', v_conflict.id, jsonb_build_object('replacement_vehicle_id', v_replacement_id, 'extension_id', p_extension_id));
  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (p_actor_id, 'future_booking_reassigned', 'bookings', v_conflict.id, jsonb_build_object('original_vehicle_id', p_vehicle_id, 'replacement_vehicle_id', v_replacement_id, 'extension_id', p_extension_id));
  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (p_actor_id, 'customer_notification_generated', 'booking_notifications', v_conflict.id, jsonb_build_object('type', 'vehicle_reassigned'));

  return 'resolved';
end;
$$;

comment on function resolve_extension_conflict is
  'Internal engine — not granted to anon/authenticated, called only from request_booking_extension and confirm_booking_extension_payment within their own SECURITY DEFINER transaction. Detects a FUTURE booking on the SAME exact vehicle that would conflict with the extended window; if found, searches for a replacement vehicle (available_vehicles() for the conflicting booking''s own dates, ranked same-model > same-category > other) and reassigns the FUTURE booking to it — never the extending customer''s own vehicle, never an automatic rejection. Returns ok (no conflict), resolved (reassigned), or unresolved (no safe replacement — requires manual admin handling, nothing changed). bookings_no_overlap remains the true double-booking guard throughout.';

revoke all on function resolve_extension_conflict(uuid, uuid, uuid, date, uuid) from public;

-- ---------------------------------------------------------------------------
-- request_booking_extension — replaces the Phase 7 (original) version.
--
-- Two modes, selected by whether p_existing_extension_id is supplied:
--   - NULL (default): the WhatsApp/support/admin channel, unchanged in
--     spirit — inserts a brand-new row (source = 'admin') and processes it
--     immediately.
--   - supplied: an admin reviewing a customer-submitted 'requested' row
--     (source = 'customer') — updates that row with the admin's decision
--     inputs (pricing, payment method, penalty if late) and runs the exact
--     same availability/conflict/finalize logic against it. This is the
--     "one engine, two entry points" design — see migration header.
-- ---------------------------------------------------------------------------
drop function if exists request_booking_extension(uuid, date, text, text, text, numeric, text, extension_pricing_policy);

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
  p_penalty_policy_used       text default null
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
      processed_by              = auth.uid()
    where id = v_extension_id;
  else
    insert into booking_extensions (
      booking_id, vehicle_id, previous_return_date, requested_return_date, extension_days,
      pricing_policy_used, amount, currency, payment_method, is_late, penalty_amount, penalty_policy_used,
      status, support_confirmed_by, support_confirmation_note, processed_by, source
    ) values (
      p_booking_id, v_booking.vehicle_id, v_booking.end_date, p_requested_return_date, v_extension_days,
      p_pricing_policy_used, p_amount, p_currency, p_payment_method, v_is_late, p_penalty_amount, p_penalty_policy_used,
      'pending', btrim(p_support_confirmed_by), p_support_confirmation_note, auth.uid(), 'admin'
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
        jsonb_build_object('method', 'cash', 'amount', p_amount, 'currency', p_currency, 'penalty_amount', p_penalty_amount));
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

revoke all on function request_booking_extension(uuid, date, text, text, text, numeric, text, extension_pricing_policy, uuid, numeric, text) from public;
grant execute on function request_booking_extension(uuid, date, text, text, text, numeric, text, extension_pricing_policy, uuid, numeric, text) to authenticated;

comment on function request_booking_extension is
  'Phase 7. SECURITY DEFINER, is_admin() checked inside. Two modes: p_existing_extension_id NULL inserts a new admin/WhatsApp-channel row and processes it immediately (unchanged in spirit from the original Phase 7 build); supplied, it instead updates and processes an existing customer-submitted ''requested'' row — the SAME engine either way. Validates 1-30 days, the exact vehicle_id, and (if late) a configured penalty policy. On a conflict with a future booking, calls resolve_extension_conflict() to attempt reassignment before ever falling back to conflict_unresolved. Cash finalizes in the same transaction; online is left pending — see confirm_booking_extension_payment.';

-- ---------------------------------------------------------------------------
-- confirm_booking_extension_payment — replaces the Phase 7 (original)
-- version. Same idempotent second step for an ONLINE extension only; now
-- also runs resolve_extension_conflict() at the moment payment succeeds,
-- since that's the first moment it's safe to actually reassign anything.
-- ---------------------------------------------------------------------------
drop function if exists confirm_booking_extension_payment(uuid, payment_status, text);

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
  v_ext        record;
  v_resolution text;
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
    insert into booking_notifications (booking_id, notification_type, payload)
    values (v_ext.booking_id, 'extension_approved', jsonb_build_object(
      'requested_return_date', v_ext.requested_return_date, 'extension_days', v_ext.extension_days,
      'amount', v_ext.amount, 'currency', v_ext.currency, 'penalty_amount', v_ext.penalty_amount));
  end if;

  return query select p_extension_id, 'approved'::text, 'paid'::payment_status;
end;
$$;

revoke all on function confirm_booking_extension_payment(uuid, payment_status, text) from public;
grant execute on function confirm_booking_extension_payment(uuid, payment_status, text) to authenticated;

comment on function confirm_booking_extension_payment is
  'Phase 7. Second step for an ONLINE extension only. Idempotent like Phase 2''s confirm_payment. Now also runs resolve_extension_conflict() here (not earlier), since payment success is the first moment it is safe to actually reassign a future booking — an extension whose online payment fails never touches anyone else''s vehicle.';

-- ---------------------------------------------------------------------------
-- reject_extension_request
--
-- Explicit admin rejection for a 'requested' or 'conflict_unresolved' row —
-- needed now that a customer-submitted request does NOT auto-resolve to
-- rejected the way the old admin-channel conflict case used to. An admin
-- can also use this to close out a 'pending' (awaiting-online-payment)
-- extension the customer no longer wants.
-- ---------------------------------------------------------------------------
create or replace function reject_extension_request(p_extension_id uuid, p_rejection_reason text)
returns table (extension_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ext record;
begin
  if not is_admin() then
    raise exception 'Only an active admin can reject an extension request.';
  end if;
  if p_rejection_reason is null or btrim(p_rejection_reason) = '' then
    raise exception 'A rejection reason is required.';
  end if;

  select * into v_ext from booking_extensions where id = p_extension_id for update;
  if not found then
    raise exception 'Extension request not found.';
  end if;
  if v_ext.status not in ('requested', 'conflict_unresolved', 'pending') then
    raise exception 'This extension request has already been resolved.';
  end if;

  update booking_extensions
  set status = 'rejected', rejection_reason = btrim(p_rejection_reason), processed_by = auth.uid()
  where id = p_extension_id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (auth.uid(), 'extension_rejected', 'booking_extensions', p_extension_id, jsonb_build_object('reason', p_rejection_reason));

  if v_ext.source = 'customer' then
    insert into booking_notifications (booking_id, notification_type, payload)
    values (v_ext.booking_id, 'extension_rejected', jsonb_build_object('reason', btrim(p_rejection_reason)));
  end if;

  return query select p_extension_id, 'rejected'::text;
end;
$$;

revoke all on function reject_extension_request(uuid, text) from public;
grant execute on function reject_extension_request(uuid, text) to authenticated;

comment on function reject_extension_request is
  'Explicit admin rejection for a requested/conflict_unresolved/pending extension. Needed because a customer-submitted request no longer auto-resolves to rejected on a conflict (it may instead be reassigned, or left conflict_unresolved for manual handling) — an admin decides explicitly when the answer really is no.';
