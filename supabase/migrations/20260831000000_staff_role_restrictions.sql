-- =============================================================================
-- Staff vs Super Admin role restrictions
--
-- Until now, `is_admin()` was the only role check in RLS — it just confirms
-- an admin_profiles row exists at all, so `staff` and `super_admin` had
-- identical database-level access. The dashboard UI only gated two things
-- to super_admin (the staff directory, the test-data reset tool).
--
-- Per the owner's decision: the Audit Log is now super_admin only, both in
-- the UI (AdminLayout hides the nav item, App.tsx guards the route with
-- SuperAdminRoute) and at the database level here, so a staff account can
-- never read it even by calling the API directly.
--
-- Revenue & Earnings (the dashboard's RevenueSection) is UI-gated only
-- (DashboardPage.tsx) and deliberately NOT restricted at the RLS level:
-- it's computed from `payments`/`bookings`, which staff must keep reading
-- for their actual job (the Payments and Bookings screens). Restricting
-- those tables would break staff's day-to-day work, so the boundary here
-- is "no aggregated revenue dashboard for staff," not "staff can't see any
-- payment amount" — worth knowing, since a staff member could in principle
-- add up individual payments themselves from the Payments list.
-- =============================================================================

create or replace function is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from admin_profiles where id = auth.uid() and role = 'super_admin'
  );
$$;

drop policy if exists "admins read audit logs" on audit_logs;

create policy "super admins read audit logs" on audit_logs
  for select using (is_super_admin());

-- Insert policy is intentionally untouched (still is_admin()) — the
-- trigger-based audit writes in the Phase 3/5/reset-tool migrations run as
-- the acting staff or super_admin user and must keep succeeding under RLS
-- regardless of who performed the action being logged.
