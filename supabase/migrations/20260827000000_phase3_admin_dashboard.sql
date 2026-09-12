-- =============================================================================
-- Phase 3 — Admin Dashboard & Operations
--
-- Deliberately small: the Phase 0 foundation already ships admin_profiles,
-- is_admin(), and "admins manage X" RLS policies on every operational
-- table (vehicles, pricing, bookings, complaints, payments, customers,
-- drivers). A signed-in admin can therefore read/write almost everything
-- the dashboard needs directly through the existing anon-key + RLS model
-- — no new Edge Functions, no second permission system, no duplicated
-- pricing/availability logic. This migration adds only the handful of
-- things that genuinely didn't exist yet:
--
--   1. A write path for audit_logs, scoped to admins logging their own
--      actions (previously read-only per Phase 0's "service role/triggers
--      only" note — that note anticipated exactly this phase).
--   2. Trigger-based audit logging on vehicles/pricing/complaints, plus
--      extending the existing booking-status trigger to also emit an
--      audit_logs row (booking_status_history remains the detailed
--      per-booking trail; audit_logs is the cross-entity activity feed).
--   3. A validation constraint on pricing (client_price <= list_price).
--   4. A read-only view classifying each vehicle's CURRENT operational
--      state (available/reserved/rented/maintenance/unavailable) for the
--      fleet dashboard. This is NOT a second availability engine — it
--      answers "what is this vehicle doing right now", not "is it
--      bookable for date range X" (that remains exclusively
--      available_vehicles(), untouched). It is a security_invoker view
--      so it enforces RLS as the querying admin, never bypassing it.
--   5. A couple of missing indexes for admin list/filter queries.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Audit log write path — admins may insert rows attributed to
--    themselves (or system-attributed rows with a null actor). This lets
--    the triggers below (which run as the acting admin, not as a
--    privileged role) succeed under RLS.
-- ---------------------------------------------------------------------------
create policy "admins insert audit logs" on audit_logs
  for insert with check (is_admin() and (actor_id = auth.uid() or actor_id is null));

-- ---------------------------------------------------------------------------
-- 2. Trigger-based audit logging
-- ---------------------------------------------------------------------------
create or replace function audit_vehicle_change()
returns trigger
language plpgsql
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'vehicle_created';
  elsif old.status is distinct from new.status then
    v_action := 'vehicle_status_changed';
  else
    v_action := 'vehicle_updated';
  end if;

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (
    auth.uid(),
    v_action,
    'vehicles',
    new.id,
    jsonb_build_object(
      'make', new.make,
      'model', new.model,
      'plate_number', new.plate_number,
      'status', new.status,
      'previous_status', case when tg_op = 'UPDATE' then old.status else null end
    )
  );
  return new;
end;
$$;

create trigger vehicles_audit
  after insert or update on vehicles
  for each row
  execute function audit_vehicle_change();

create or replace function audit_pricing_change()
returns trigger
language plpgsql
as $$
begin
  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'pricing_created' else 'pricing_changed' end,
    'pricing',
    new.id,
    jsonb_build_object(
      'vehicle_id', new.vehicle_id,
      'term', new.term,
      'list_price', new.list_price,
      'client_price', new.client_price,
      'previous_list_price', case when tg_op = 'UPDATE' then old.list_price else null end,
      'previous_client_price', case when tg_op = 'UPDATE' then old.client_price else null end
    )
  );
  return new;
end;
$$;

create trigger pricing_audit
  after insert or update on pricing
  for each row
  execute function audit_pricing_change();

create or replace function audit_complaint_status_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (
      auth.uid(),
      'complaint_status_changed',
      'complaints',
      new.id,
      jsonb_build_object('previous_status', old.status, 'new_status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger complaints_audit
  after update on complaints
  for each row
  execute function audit_complaint_status_change();

-- Extends the Phase 0 trigger function in place (same trigger binding,
-- new body) so booking status changes also appear in the cross-entity
-- audit feed, without duplicating the booking_status_history mechanism.
create or replace function handle_booking_status_change()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into booking_status_history (booking_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());

    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (
      auth.uid(),
      'booking_status_changed',
      'bookings',
      new.id,
      jsonb_build_object('previous_status', old.status, 'new_status', new.status)
    );
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2b. Complaint detail fields the admin dashboard needs
-- The Phase 0 `complaints` table has no home for staff-only working
-- notes or a final resolution summary — both are explicitly required by
-- the Phase 3 Complaint Detail view. Nullable, admin-only via the
-- existing "admins manage complaints" RLS policy (unchanged); customers
-- never see these columns because their own RLS policy only lets them
-- read/create their own complaint, and the customer-facing app has no UI
-- for these fields at all.
-- ---------------------------------------------------------------------------
alter table complaints add column internal_notes text;
alter table complaints add column resolution text;

comment on column complaints.internal_notes is 'Staff-only working notes, never shown to the customer.';
comment on column complaints.resolution is 'Final resolution summary, set when a complaint moves to resolved/closed.';

-- ---------------------------------------------------------------------------
-- 3. Pricing validation
-- ---------------------------------------------------------------------------
alter table pricing
  add constraint pricing_client_price_le_list_price check (client_price <= list_price);

comment on constraint pricing_client_price_le_list_price on pricing is
  'client_price is the actual bookable price; list_price is the struck-through reference price shown alongside it. The reference price can never read lower than the real price.';

-- ---------------------------------------------------------------------------
-- 4. Fleet operational status (admin dashboard only)
-- ---------------------------------------------------------------------------
create view vehicle_operational_status
  with (security_invoker = true)
as
select
  v.id as vehicle_id,
  v.status as vehicle_status,
  case
    when v.status = 'maintenance' then 'maintenance'
    when v.status = 'retired' then 'unavailable'
    when exists (
      select 1 from bookings b
      where b.vehicle_id = v.id and b.status = 'active'
    ) then 'rented'
    when exists (
      select 1 from bookings b
      where b.vehicle_id = v.id and b.status = 'confirmed' and b.end_date >= current_date
    ) then 'reserved'
    else 'available'
  end as operational_status
from vehicles v;

comment on view vehicle_operational_status is
  'Admin-only, CURRENT-moment operational classification per vehicle (available/reserved/rented/maintenance/unavailable), for the fleet dashboard. security_invoker = true so it enforces RLS as the querying admin rather than the view owner — it is NOT a second availability engine and never answers "is this vehicle bookable for date range X"; that remains exclusively available_vehicles().';

grant select on vehicle_operational_status to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Indexes for admin list/filter queries
-- ---------------------------------------------------------------------------
create index payments_status_idx on payments (status);
create index complaints_status_idx on complaints (status);
create index audit_logs_created_at_idx on audit_logs (created_at desc);
create index bookings_created_at_idx on bookings (created_at desc);
