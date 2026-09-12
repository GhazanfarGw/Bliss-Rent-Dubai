-- =============================================================================
-- Phase 7 — Rental Extension & Extension Payments
--
-- NOT YET APPLIED TO PRODUCTION. Written and tested locally only, per this
-- phase's explicit instruction: build and test locally first, then stop.
--
-- BUSINESS MODEL (locked, from the owner's Phase 7 brief):
--   Customers never request an extension from the website. They contact
--   customer support on WhatsApp; support confirms the request with the
--   customer; only THEN does an admin record the confirmed request in the
--   dashboard, which is the one and only entry point into this feature.
--   There is no customer-facing "Extend booking" button anywhere, and
--   WhatsApp itself is never touched by this system — support confirmation
--   is captured as two plain fields the admin fills in (who confirmed it,
--   an optional note/reference), not a live integration.
--
-- REUSES, UNCHANGED:
--   - `bookings` — only `end_date` is ever updated by this feature; the
--     row's `id` (and therefore its derived booking_reference, computed
--     the same way as Phase 6's get_booking_by_reference:
--     'BLS-' || upper(left(replace(id::text,'-',''),8)) — never stored,
--     never regenerated) never changes.
--   - `bookings_no_overlap` (Phase 0 GIST exclusion constraint on
--     vehicle_id + daterange) — this is what actually makes "same exact
--     physical vehicle, race-safe" true. Nothing below weakens, replaces,
--     or bypasses it; the extension's own availability check is deliberately
--     implemented as a plain read of the SAME exclusion condition, and the
--     real protection comes from extending the booking's own end_date
--     through a normal UPDATE that constraint still governs (see
--     request_booking_extension/confirm_booking_extension_payment below —
--     same "the exclusion constraint is the real guard, not the pre-check"
--     pattern Phase 2's create_booking already uses).
--   - `payments`, `payment_status` — the extension's own payment is a
--     SEPARATE record (booking_extensions.payment_method/payment_status
--     below), never a row in `payments`, so it can never be confused with
--     or double-count against the original booking's payment.
--   - `is_admin()` / `is_active` (Staff Account Control migration) — an
--     extension can be processed by ANY active admin, same as bookings and
--     payments already are (`"admins manage bookings"`,
--     `"admins manage payments"` are both plain `is_admin()`, not
--     super_admin-only) — staff are not given anything they couldn't
--     already do. A suspended admin is blocked automatically, because
--     `is_admin()` already requires `is_active = true`.
--   - `audit_logs` — every meaningful transition is one more row through
--     the existing table, same `actor_id/action/entity_table/entity_id/
--     metadata` shape every other migration in this project already uses.
--
-- NEW, MINIMAL:
--   - One new table for the extension record itself (`booking_extensions`).
--   - One tiny singleton settings table (`extension_pricing_settings`) so
--     the pricing METHOD is a runtime config value, not a hard-coded
--     assumption — see the "PRICING POLICY — DELIBERATELY LEFT UNSET"
--     note below. Changing it is restricted to `is_super_admin()`: it is
--     an owner-level business decision, not routine day-to-day admin work.
--   - Two new SECURITY DEFINER functions and one read-only helper.
--
-- PRICING POLICY — DELIBERATELY LEFT UNSET:
--   The owner has not yet confirmed whether an extension bills at the
--   ORIGINAL booking's daily rate, the vehicle's CURRENT daily rate, or a
--   separate CUSTOM extension rate. `extension_pricing_settings.policy`
--   is seeded as NULL on purpose. Nothing in this migration — or in the
--   TypeScript pricing layer that computes the actual amount (see
--   src/lib/extensionPricing.ts) — ever guesses a default. Every extension
--   amount is computed in TypeScript (same "one authoritative pricing
--   calculation path" convention Phase 2's create_booking already
--   established for the original booking price) against WHICHEVER policy
--   is configured at the time; request_booking_extension() below only
--   re-checks that the caller's `p_pricing_policy_used` still matches the
--   currently configured policy (so a stale price computed under an old
--   policy can never silently slip through if the owner changes it
--   mid-session) and that the amount isn't negative — the same
--   "data-integrity backstop, not a second pricing implementation"
--   philosophy `create_booking`'s own comment already documents.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type extension_status as enum ('pending', 'approved', 'rejected');
create type extension_pricing_policy as enum ('original_rate', 'current_rate', 'custom_rate');

-- ---------------------------------------------------------------------------
-- extension_pricing_settings — singleton config row.
-- ---------------------------------------------------------------------------
create table extension_pricing_settings (
  id                 smallint primary key default 1 check (id = 1),
  policy             extension_pricing_policy,
  custom_daily_rate  numeric check (custom_daily_rate is null or custom_daily_rate >= 0),
  custom_currency    text not null default 'AED',
  updated_by         uuid references admin_profiles (id),
  updated_at         timestamptz not null default now()
);

comment on table extension_pricing_settings is
  'Singleton (id always 1). policy starts NULL — the owner has not yet confirmed original/current/custom-rate billing for extensions. The extension request flow refuses to proceed until an active policy is set here. See migration header.';

insert into extension_pricing_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- booking_extensions — the extension record itself.
-- ---------------------------------------------------------------------------
create table booking_extensions (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null references bookings (id) on delete restrict,
  -- Denormalized on purpose: the physical vehicle this specific extension
  -- was checked and billed against, permanently, even if some future
  -- feature ever allowed a booking's vehicle_id to change (it can't
  -- today). This is what requirement #13/#15 ("check the actual vehicle
  -- ID, never the model") is verified against, both in code review and in
  -- the record itself.
  vehicle_id                  uuid not null references vehicles (id) on delete restrict,
  previous_return_date        date not null,
  requested_return_date       date not null,
  extension_days              integer not null,
  availability_confirmed      boolean not null,
  pricing_policy_used         extension_pricing_policy,
  amount                      numeric check (amount is null or amount >= 0),
  currency                    text,
  payment_method              text check (payment_method is null or payment_method in ('cash', 'online')),
  payment_status              payment_status,
  status                      extension_status not null default 'pending',
  rejection_reason            text,
  support_confirmed_by        text not null,
  support_confirmation_note   text,
  processed_by                uuid not null references admin_profiles (id),
  payment_confirmed_by        uuid references admin_profiles (id),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint booking_extensions_valid_range check (requested_return_date > previous_return_date),
  constraint booking_extensions_days_bounds check (extension_days between 1 and 30),
  constraint booking_extensions_days_match check (requested_return_date - previous_return_date = extension_days)
);

comment on table booking_extensions is
  'One row per confirmed WhatsApp/customer-support extension request that an admin recorded. The original booking (bookings.id / its derived reference) is never touched except for end_date. Every write happens through request_booking_extension()/confirm_booking_extension_payment() — there is NO direct insert/update policy for any role, admin included, so the availability check and payment/approval sequencing can never be bypassed by calling the table directly.';

create index booking_extensions_booking_id_idx on booking_extensions (booking_id);
create index booking_extensions_vehicle_id_idx on booking_extensions (vehicle_id);
create index booking_extensions_status_idx on booking_extensions (status);

-- Phase 0 doesn't use a generic timestamp extension anywhere (bookings'
-- own updated_at is set inline inside handle_booking_status_change) — this
-- follows the same plain, explicit style rather than introducing one.
create or replace function booking_extensions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger booking_extensions_set_updated_at_trigger
  before update on booking_extensions
  for each row execute function booking_extensions_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table extension_pricing_settings enable row level security;
alter table booking_extensions enable row level security;

create policy "admins read extension pricing settings" on extension_pricing_settings
  for select using (is_admin());

create policy "super admins update extension pricing settings" on extension_pricing_settings
  for update using (is_super_admin()) with check (is_super_admin());

create policy "admins read booking extensions" on booking_extensions
  for select using (is_admin());

-- Deliberately no insert/update/delete policy on booking_extensions for
-- ANY role. The only way a row is ever created or changed is through the
-- two SECURITY DEFINER functions below, which check is_admin() themselves
-- and enforce the availability-then-payment sequence in one atomic
-- transaction — see requirement #6, "Admin cannot arbitrarily extend a
-- booking without the confirmed customer-support request."

-- ---------------------------------------------------------------------------
-- check_vehicle_availability_for_extension
--
-- Read-only preview for the admin UI, BEFORE committing to a request —
-- lets the screen show "available" / "not available" while the admin is
-- still filling in the form. This is a convenience only: the real,
-- race-safe guarantee is the bookings_no_overlap exclusion constraint
-- re-applied inside request_booking_extension/confirm_booking_extension_payment
-- at the moment the booking's end_date actually changes, not this preview.
-- ---------------------------------------------------------------------------
create or replace function check_vehicle_availability_for_extension(
  p_booking_id uuid,
  p_requested_return_date date
)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_booking record;
begin
  if not is_admin() then
    raise exception 'Only an active admin can check extension availability.';
  end if;

  select id, vehicle_id, end_date into v_booking from bookings where id = p_booking_id;
  if not found then
    raise exception 'Booking not found.';
  end if;

  return not exists (
    select 1 from bookings
    where vehicle_id = v_booking.vehicle_id
      and id <> p_booking_id
      and status <> 'cancelled'
      and daterange(start_date, end_date, '[]') && daterange(v_booking.end_date, p_requested_return_date, '[]')
  );
end;
$$;

revoke all on function check_vehicle_availability_for_extension(uuid, date) from public;
grant execute on function check_vehicle_availability_for_extension(uuid, date) to authenticated;

comment on function check_vehicle_availability_for_extension is
  'Read-only preview only — checks the SAME physical vehicle_id (never model/category), never suggests or checks any other vehicle. Real protection against a race is the bookings_no_overlap exclusion constraint, re-applied where it actually matters: the UPDATE bookings...end_date inside request_booking_extension/confirm_booking_extension_payment.';

-- ---------------------------------------------------------------------------
-- request_booking_extension
--
-- The one entry point for recording an already-confirmed (via WhatsApp +
-- customer support, outside this system) extension request. Validates
-- 1-30 days, re-checks the exact vehicle's availability, and — only for a
-- CASH payment — completes the whole approval in one step (cash is
-- collected at the moment of processing, so there is nothing left to wait
-- for). An ONLINE payment is left pending: see confirm_booking_extension_payment.
-- ---------------------------------------------------------------------------
create or replace function request_booking_extension(
  p_booking_id                uuid,
  p_requested_return_date     date,
  p_support_confirmed_by      text,
  p_support_confirmation_note text,
  p_payment_method            text,
  p_amount                    numeric,
  p_currency                  text,
  p_pricing_policy_used       extension_pricing_policy
)
returns table (
  extension_id     uuid,
  status           extension_status,
  payment_status   payment_status,
  rejection_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking          record;
  v_extension_id     uuid;
  v_extension_days   integer;
  v_conflict_exists  boolean;
  v_status           extension_status;
  v_payment_status   payment_status;
  v_rejection_reason text;
  v_current_policy   extension_pricing_policy;
  v_plate            text;
begin
  if not is_admin() then
    raise exception 'Only an active admin can process rental extensions.';
  end if;

  if p_support_confirmed_by is null or btrim(p_support_confirmed_by) = '' then
    raise exception 'Who confirmed this with the customer is required.';
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

  -- Availability check against the EXACT physical vehicle only
  -- (v_booking.vehicle_id, never model/category/make) — requirement
  -- #13/#15. Mirrors the bookings_no_overlap exclusion constraint's own
  -- condition exactly.
  select exists (
    select 1 from bookings
    where vehicle_id = v_booking.vehicle_id
      and id <> p_booking_id
      and status <> 'cancelled'
      and daterange(start_date, end_date, '[]') && daterange(v_booking.end_date, p_requested_return_date, '[]')
  ) into v_conflict_exists;

  if v_conflict_exists then
    select plate_number into v_plate from vehicles where id = v_booking.vehicle_id;
    v_status := 'rejected';
    v_payment_status := null;
    v_rejection_reason := 'Vehicle ' || coalesce(v_plate, v_booking.vehicle_id::text)
      || ' is already booked for part of the requested dates. No other vehicle was substituted — extension rejected.';
  elsif p_payment_method = 'cash' then
    v_status := 'approved';
    v_payment_status := 'paid';
    v_rejection_reason := null;
  else
    v_status := 'pending';
    v_payment_status := 'pending';
    v_rejection_reason := null;
  end if;

  insert into booking_extensions (
    booking_id, vehicle_id, previous_return_date, requested_return_date, extension_days,
    availability_confirmed, pricing_policy_used, amount, currency, payment_method,
    payment_status, status, rejection_reason, support_confirmed_by, support_confirmation_note,
    processed_by
  ) values (
    p_booking_id, v_booking.vehicle_id, v_booking.end_date, p_requested_return_date, v_extension_days,
    not v_conflict_exists, p_pricing_policy_used, p_amount, p_currency, p_payment_method,
    v_payment_status, v_status, v_rejection_reason, btrim(p_support_confirmed_by), p_support_confirmation_note,
    auth.uid()
  )
  returning id into v_extension_id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (
    auth.uid(), 'extension_requested', 'booking_extensions', v_extension_id,
    jsonb_build_object(
      'booking_id', p_booking_id, 'vehicle_id', v_booking.vehicle_id,
      'previous_return_date', v_booking.end_date, 'requested_return_date', p_requested_return_date,
      'extension_days', v_extension_days, 'support_confirmed_by', p_support_confirmed_by
    )
  );

  if v_conflict_exists then
    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (auth.uid(), 'extension_rejected', 'booking_extensions', v_extension_id, jsonb_build_object('reason', v_rejection_reason));
    return query select v_extension_id, v_status, v_payment_status, v_rejection_reason;
    return;
  end if;

  if p_payment_method = 'cash' then
    -- The actual double-booking guard: if another booking for this exact
    -- vehicle was committed for an overlapping date between the pre-check
    -- above and this UPDATE, Postgres raises exclusion_violation (23P01)
    -- right here and the whole transaction — including the extension row
    -- just inserted — rolls back atomically. Same pattern as
    -- create_booking() in Phase 2; bookings_no_overlap is untouched.
    update bookings set end_date = p_requested_return_date where id = p_booking_id;

    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (
      auth.uid(), 'booking_return_date_changed', 'bookings', p_booking_id,
      jsonb_build_object('previous_return_date', v_booking.end_date, 'new_return_date', p_requested_return_date, 'extension_id', v_extension_id)
    );

    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (auth.uid(), 'extension_payment_recorded', 'booking_extensions', v_extension_id, jsonb_build_object('method', 'cash', 'amount', p_amount, 'currency', p_currency));

    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (auth.uid(), 'extension_approved', 'booking_extensions', v_extension_id, jsonb_build_object('payment_method', 'cash'));
  end if;
  -- Online: extension stays 'pending' / payment_status 'pending' — the
  -- booking's end_date is NOT changed yet. See confirm_booking_extension_payment.

  return query select v_extension_id, v_status, v_payment_status, v_rejection_reason;
end;
$$;

revoke all on function request_booking_extension(uuid, date, text, text, text, numeric, text, extension_pricing_policy) from public;
grant execute on function request_booking_extension(uuid, date, text, text, text, numeric, text, extension_pricing_policy) to authenticated;

comment on function request_booking_extension is
  'Phase 7. SECURITY DEFINER, is_admin() checked inside (same authenticated-admin-session pattern as admin_reset_all_test_data — no Edge Function needed, unlike guest checkout). Validates 1-30 days, checks the EXACT vehicle_id (never model), rejects with no substitution on conflict, and for cash completes approval + the booking end_date update in the same atomic transaction the bookings_no_overlap exclusion constraint still protects. Online payments are left pending — see confirm_booking_extension_payment.';

-- ---------------------------------------------------------------------------
-- confirm_booking_extension_payment
--
-- The second step for an ONLINE extension only: an admin (or, once a real
-- gateway exists, its webhook) marks the payment received. Idempotent,
-- same convention as Phase 2's confirm_payment — a repeat call for an
-- already-resolved extension is a no-op that returns the existing state.
-- ---------------------------------------------------------------------------
create or replace function confirm_booking_extension_payment(
  p_extension_id uuid,
  p_outcome      payment_status,
  p_reference    text
)
returns table (
  extension_id   uuid,
  status         extension_status,
  payment_status payment_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ext record;
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

  -- The actual double-booking guard, applied at the moment the extra days
  -- are actually granted — not weakened, not bypassed: if another booking
  -- for this exact vehicle was committed for an overlapping date in the
  -- time since the original request, this raises exclusion_violation
  -- (23P01) and the whole payment confirmation rolls back — the extension
  -- stays pending/unpaid rather than being silently marked paid for days
  -- the vehicle can no longer cover.
  update bookings set end_date = v_ext.requested_return_date where id = v_ext.booking_id;

  update booking_extensions
  set payment_status = 'paid', status = 'approved', payment_confirmed_by = auth.uid()
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

  return query select p_extension_id, 'approved'::extension_status, 'paid'::payment_status;
end;
$$;

revoke all on function confirm_booking_extension_payment(uuid, payment_status, text) from public;
grant execute on function confirm_booking_extension_payment(uuid, payment_status, text) to authenticated;

comment on function confirm_booking_extension_payment is
  'Phase 7. Second step for an ONLINE extension only — cash is already resolved by request_booking_extension. Idempotent like Phase 2''s confirm_payment. The booking''s end_date is only updated HERE (not at request time) for online payments, through the same bookings_no_overlap-protected UPDATE, so a vehicle that became unavailable while payment was pending cannot silently be granted the extra days.';
