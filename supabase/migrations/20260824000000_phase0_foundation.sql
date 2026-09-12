-- =============================================================================
-- Phase 0 — Project Foundation & Architecture
-- Dubai Airport Car Rental platform
--
-- Business rules encoded by this schema (see docs/ARCHITECTURE.md for the
-- full rationale):
--   - Website = Booking. WhatsApp = Complaints/Support only (no WhatsApp
--     booking tables or flows exist here on purpose).
--   - Customer provides their own driver. There is no company-driver
--     assignment table.
--   - Coverage = Dubai only. `locations` has no emirate/country column
--     because multi-region is out of scope for this phase.
--   - Sensitive driver/customer documents are stored in a PRIVATE storage
--     bucket and are never publicly readable.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "btree_gist"; -- exclusion constraint on bookings

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type admin_role as enum ('super_admin', 'staff');
create type vehicle_status as enum ('available', 'maintenance', 'retired');
create type pricing_term as enum ('daily', 'weekly', 'monthly', '3_month');
create type booking_status as enum (
  'pending_payment',  -- created, awaiting payment
  'confirmed',        -- paid, awaiting handover
  'active',           -- vehicle handed over, rental in progress
  'completed',        -- vehicle returned, booking closed
  'cancelled'
);
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type complaint_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type location_type as enum ('airport', 'city');

-- ---------------------------------------------------------------------------
-- Admin users
-- One row per staff/admin, linked 1:1 to a Supabase Auth user.
-- ---------------------------------------------------------------------------
create table admin_profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  role        admin_role not null default 'staff',
  created_at  timestamptz not null default now()
);

comment on table admin_profiles is 'Staff/admin accounts. Presence of a row here (not just an auth.users row) is what grants dashboard access.';

-- Helper used throughout RLS policies below. security definer so it can read
-- admin_profiles even under a caller whose own row-level policy would
-- otherwise hide it from them.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from admin_profiles where id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Customers
-- A customer may book as a guest (auth_user_id null, matched by email) or
-- as a signed-in Supabase Auth user. Phase 1+ decides which flows are
-- actually exposed in the UI; both are supported at the schema level.
-- ---------------------------------------------------------------------------
create table customers (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  full_name     text not null,
  email         text not null,
  phone         text,
  created_at    timestamptz not null default now()
);

create unique index customers_email_key on customers (lower(email));

comment on table customers is 'Renters. auth_user_id is nullable to allow a guest-checkout flow if the business wants one later.';

-- ---------------------------------------------------------------------------
-- Drivers
-- The COMPANY DOES NOT PROVIDE DRIVERS. This table captures the driver
-- details the *customer* supplies for a given booking (may or may not be
-- the customer themselves).
-- ---------------------------------------------------------------------------
create table drivers (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null, -- FK added after bookings exists (see below)
  full_name             text not null,
  date_of_birth         date not null,
  license_number        text not null,
  license_country       text not null,
  license_expiry        date not null,
  license_document_path text, -- path inside the private 'driver-documents' bucket
  id_document_path      text, -- path inside the private 'driver-documents' bucket
  created_at            timestamptz not null default now()
);

comment on table drivers is 'Customer-supplied driver details for a booking. Never a company-assigned driver — see docs/ARCHITECTURE.md, "Customer provides their own driver".';
comment on column drivers.license_document_path is 'Private storage path only. Never expose via a public URL — see driver-documents bucket policy.';

-- ---------------------------------------------------------------------------
-- Fleet
-- ---------------------------------------------------------------------------
create table vehicle_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique, -- e.g. 'Economy', 'Luxury'
  description text,
  created_at  timestamptz not null default now()
);

create table vehicles (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references vehicle_categories (id) on delete restrict,
  make          text not null,
  model         text not null,
  model_year    smallint not null,
  transmission  text not null default 'automatic',
  seats         smallint not null default 5,
  plate_number  text not null unique,
  status        vehicle_status not null default 'available',
  created_at    timestamptz not null default now()
);

create index vehicles_category_id_idx on vehicles (category_id);
create index vehicles_status_idx on vehicles (status);

create table vehicle_images (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references vehicles (id) on delete cascade,
  storage_path  text not null, -- path inside the public 'vehicle-images' bucket
  is_primary    boolean not null default false,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now()
);

create index vehicle_images_vehicle_id_idx on vehicle_images (vehicle_id);

-- ---------------------------------------------------------------------------
-- Pricing
-- Mirrors the client's list-price vs. client-price ladder per rental term.
-- ---------------------------------------------------------------------------
create table pricing (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references vehicles (id) on delete cascade,
  term          pricing_term not null,
  list_price    numeric(10, 2) not null check (list_price >= 0),
  client_price  numeric(10, 2) not null check (client_price >= 0),
  currency      text not null default 'AED',
  created_at    timestamptz not null default now(),
  unique (vehicle_id, term)
);

comment on column pricing.list_price is 'Struck-through reference price shown on the pricing ladder.';
comment on column pricing.client_price is 'Actual bookable price for this term.';

-- ---------------------------------------------------------------------------
-- Pickup / drop-off locations (Dubai only — see docs/ARCHITECTURE.md)
-- ---------------------------------------------------------------------------
create table locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique, -- e.g. 'DXB Terminal 3', 'Downtown Dubai'
  type        location_type not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table bookings (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references customers (id) on delete restrict,
  vehicle_id          uuid not null references vehicles (id) on delete restrict,
  pickup_location_id  uuid not null references locations (id) on delete restrict,
  dropoff_location_id uuid not null references locations (id) on delete restrict,
  term                pricing_term not null,
  start_date          date not null,
  end_date            date not null,
  status              booking_status not null default 'pending_payment',
  total_price         numeric(10, 2) not null check (total_price >= 0),
  currency            text not null default 'AED',
  booking_channel     text not null default 'website', -- website is the ONLY booking channel; column kept explicit/auditable rather than assumed
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (end_date >= start_date),
  check (booking_channel = 'website')
);

alter table drivers
  add constraint drivers_booking_id_fkey
  foreign key (booking_id) references bookings (id) on delete cascade;

create index drivers_booking_id_idx on drivers (booking_id);
create index bookings_customer_id_idx on bookings (customer_id);
create index bookings_vehicle_id_idx on bookings (vehicle_id);
create index bookings_status_idx on bookings (status);

-- Prevent double-booking the same vehicle for overlapping date ranges,
-- ignoring bookings that were cancelled.
alter table bookings
  add constraint bookings_no_overlap
  exclude using gist (
    vehicle_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
  where (status <> 'cancelled');

create table booking_status_history (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings (id) on delete cascade,
  old_status  booking_status,
  new_status  booking_status not null,
  changed_by  uuid references auth.users (id) on delete set null,
  changed_at  timestamptz not null default now()
);

create index booking_status_history_booking_id_idx on booking_status_history (booking_id);

-- Keep updated_at current and log every status transition automatically.
create or replace function handle_booking_status_change()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into booking_status_history (booking_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger bookings_status_change
  before update on bookings
  for each row
  execute function handle_booking_status_change();

-- ---------------------------------------------------------------------------
-- Payments
-- Writes are restricted to admins/service role at the RLS layer below —
-- payment state should be set by a verified server-side flow (Edge
-- Function + payment provider webhook), never directly by the client.
-- ---------------------------------------------------------------------------
create table payments (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings (id) on delete restrict,
  amount              numeric(10, 2) not null check (amount >= 0),
  currency            text not null default 'AED',
  status              payment_status not null default 'pending',
  provider            text not null,
  provider_reference  text,
  paid_at             timestamptz,
  created_at          timestamptz not null default now()
);

create index payments_booking_id_idx on payments (booking_id);

-- ---------------------------------------------------------------------------
-- Complaints / Support
-- WHATSAPP IS THE CHANNEL, NOT THE STORAGE. Every WhatsApp conversation
-- about a rental issue is expected to be logged here by staff (or by a
-- future WhatsApp integration in a later phase) so it's visible in the
-- admin dashboard alongside the booking.
-- ---------------------------------------------------------------------------
create table complaints (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references bookings (id) on delete set null,
  customer_id   uuid not null references customers (id) on delete restrict,
  subject       text not null,
  description   text not null,
  status        complaint_status not null default 'open',
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index complaints_booking_id_idx on complaints (booking_id);
create index complaints_customer_id_idx on complaints (customer_id);

-- ---------------------------------------------------------------------------
-- Audit log
-- Generic append-only log for admin-side changes to sensitive records.
-- Populated by application/edge-function code in later phases; the table
-- exists now so nothing has to be retrofitted.
-- ---------------------------------------------------------------------------
create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references auth.users (id) on delete set null,
  action        text not null,
  entity_table  text not null,
  entity_id     uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs (entity_table, entity_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table admin_profiles enable row level security;
alter table customers enable row level security;
alter table drivers enable row level security;
alter table vehicle_categories enable row level security;
alter table vehicles enable row level security;
alter table vehicle_images enable row level security;
alter table pricing enable row level security;
alter table locations enable row level security;
alter table bookings enable row level security;
alter table booking_status_history enable row level security;
alter table payments enable row level security;
alter table complaints enable row level security;
alter table audit_logs enable row level security;

-- admin_profiles: a user can see their own row; admins can see everyone's.
create policy "admin can read own profile" on admin_profiles
  for select using (id = auth.uid());
create policy "admins read all admin profiles" on admin_profiles
  for select using (is_admin());
create policy "admins manage admin profiles" on admin_profiles
  for all using (is_admin()) with check (is_admin());

-- customers: self-service for the owning auth user; full access for admins.
create policy "customers read own row" on customers
  for select using (auth_user_id = auth.uid());
create policy "customers update own row" on customers
  for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy "admins manage customers" on customers
  for all using (is_admin()) with check (is_admin());

-- drivers: visible to the customer who owns the parent booking, and to admins.
create policy "customers read own driver rows" on drivers
  for select using (
    exists (
      select 1 from bookings b
      join customers c on c.id = b.customer_id
      where b.id = drivers.booking_id and c.auth_user_id = auth.uid()
    )
  );
create policy "customers insert own driver rows" on drivers
  for insert with check (
    exists (
      select 1 from bookings b
      join customers c on c.id = b.customer_id
      where b.id = drivers.booking_id and c.auth_user_id = auth.uid()
    )
  );
create policy "admins manage drivers" on drivers
  for all using (is_admin()) with check (is_admin());

-- Fleet & pricing & locations: publicly readable (needed for anonymous
-- browsing before a customer logs in), writable by admins only.
create policy "public reads vehicle categories" on vehicle_categories
  for select using (true);
create policy "admins manage vehicle categories" on vehicle_categories
  for all using (is_admin()) with check (is_admin());

create policy "public reads vehicles" on vehicles
  for select using (true);
create policy "admins manage vehicles" on vehicles
  for all using (is_admin()) with check (is_admin());

create policy "public reads vehicle images" on vehicle_images
  for select using (true);
create policy "admins manage vehicle images" on vehicle_images
  for all using (is_admin()) with check (is_admin());

create policy "public reads pricing" on pricing
  for select using (true);
create policy "admins manage pricing" on pricing
  for all using (is_admin()) with check (is_admin());

create policy "public reads locations" on locations
  for select using (true);
create policy "admins manage locations" on locations
  for all using (is_admin()) with check (is_admin());

-- bookings: a customer can read/create their own; admins full access.
-- Update is intentionally NOT granted to customers here — status changes
-- (cancel, etc.) should go through a controlled server-side path in a
-- later phase rather than a raw client-side UPDATE.
create policy "customers read own bookings" on bookings
  for select using (
    exists (select 1 from customers c where c.id = bookings.customer_id and c.auth_user_id = auth.uid())
  );
create policy "customers create own bookings" on bookings
  for insert with check (
    exists (select 1 from customers c where c.id = bookings.customer_id and c.auth_user_id = auth.uid())
  );
create policy "admins manage bookings" on bookings
  for all using (is_admin()) with check (is_admin());

create policy "customers read own booking history" on booking_status_history
  for select using (
    exists (
      select 1 from bookings b
      join customers c on c.id = b.customer_id
      where b.id = booking_status_history.booking_id and c.auth_user_id = auth.uid()
    )
  );
create policy "admins manage booking history" on booking_status_history
  for all using (is_admin()) with check (is_admin());

-- payments: customers can only ever read their own; all writes are
-- admin/service-role only (service role bypasses RLS entirely).
create policy "customers read own payments" on payments
  for select using (
    exists (
      select 1 from bookings b
      join customers c on c.id = b.customer_id
      where b.id = payments.booking_id and c.auth_user_id = auth.uid()
    )
  );
create policy "admins manage payments" on payments
  for all using (is_admin()) with check (is_admin());

-- complaints: customers manage their own; admins full access. This is the
-- structured record of a WhatsApp support conversation, not a booking
-- channel.
create policy "customers read own complaints" on complaints
  for select using (
    exists (select 1 from customers c where c.id = complaints.customer_id and c.auth_user_id = auth.uid())
  );
create policy "customers create own complaints" on complaints
  for insert with check (
    exists (select 1 from customers c where c.id = complaints.customer_id and c.auth_user_id = auth.uid())
  );
create policy "admins manage complaints" on complaints
  for all using (is_admin()) with check (is_admin());

-- audit_logs: admin-read only; nothing inserts here directly from the
-- client (service role / triggers only).
create policy "admins read audit logs" on audit_logs
  for select using (is_admin());

-- ---------------------------------------------------------------------------
-- Storage buckets
-- 'vehicle-images'   -> public, for fleet photos.
-- 'driver-documents' -> private, for license/ID uploads. Never public.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('vehicle-images', 'vehicle-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do nothing;

create policy "public reads vehicle images bucket" on storage.objects
  for select using (bucket_id = 'vehicle-images');
create policy "admins write vehicle images bucket" on storage.objects
  for insert with check (bucket_id = 'vehicle-images' and is_admin());
create policy "admins update vehicle images bucket" on storage.objects
  for update using (bucket_id = 'vehicle-images' and is_admin());
create policy "admins delete vehicle images bucket" on storage.objects
  for delete using (bucket_id = 'vehicle-images' and is_admin());

-- Driver documents: no public policy at all. Authenticated customers may
-- upload into their own booking's folder (path convention:
-- `<booking_id>/<file>`); only admins may read them back.
create policy "customers upload own driver documents" on storage.objects
  for insert with check (
    bucket_id = 'driver-documents'
    and exists (
      select 1 from bookings b
      join customers c on c.id = b.customer_id
      where c.auth_user_id = auth.uid()
        and b.id::text = (storage.foldername(name))[1]
    )
  );
create policy "admins read driver documents" on storage.objects
  for select using (bucket_id = 'driver-documents' and is_admin());
create policy "admins delete driver documents" on storage.objects
  for delete using (bucket_id = 'driver-documents' and is_admin());
