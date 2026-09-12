-- =============================================================================
-- TEMPORARY — Testing-phase data reset (requested 2026-08-27)
--
-- Bliss Rent is still being loaded with example vehicles/bookings/customers
-- while the team tests the admin dashboard, and some of that example data is
-- inaccurate or embarrassing to show the real team once testing is done
-- (see chat: "we add very bad testing data ... team see and do not like
-- it"). This migration adds ONE function, admin_reset_all_test_data(), that
-- a super_admin can call from a "Danger Zone" button in Admin > Settings to
-- wipe every transactional/test record back to zero, without touching the
-- database schema, admin accounts, or structural config (vehicle_categories,
-- locations) that the app needs to keep working.
--
-- THIS IS INTENTIONALLY TEMPORARY. Once testing is finished and the team is
-- ready to go live with real data, remove:
--   1. This function (drop function admin_reset_all_test_data();)
--   2. The "Danger Zone" section in src/features/admin/settings/AdminSettingsPage.tsx
--   3. resetAllTestData() in src/features/admin/settings/adminSettingsApi.ts
-- so nobody can ever click it again after go-live.
-- =============================================================================

create or replace function admin_reset_all_test_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role admin_role;
  v_counts jsonb;
begin
  -- Checked here, not just via RLS, because this bypasses "on delete
  -- restrict" one row at a time in favour of clearing whole tables —
  -- deliberately stricter than the "admins manage X" policies used
  -- everywhere else. Any admin_profiles row missing (non-admin caller)
  -- makes v_role null, which is also distinct from 'super_admin' below.
  select role into v_role from admin_profiles where id = auth.uid();

  if v_role is distinct from 'super_admin' then
    raise exception 'Only a super_admin can reset test data';
  end if;

  select jsonb_build_object(
    'payments', (select count(*) from payments),
    'complaints', (select count(*) from complaints),
    'bookings', (select count(*) from bookings),
    'drivers', (select count(*) from drivers),
    'vehicles', (select count(*) from vehicles),
    'customers', (select count(*) from customers),
    'audit_logs', (select count(*) from audit_logs)
  ) into v_counts;

  -- Order respects the "on delete restrict" foreign keys from Phase 0
  -- (payments/bookings -> restrict; bookings -> customers/vehicles/
  -- locations -> restrict). drivers, booking_status_history,
  -- vehicle_images and pricing all cascade automatically from
  -- bookings/vehicles, so they do not need their own delete statement.
  -- vehicle_categories and locations are left untouched on purpose —
  -- they are dropdown/config data, not test records.
  --
  -- "where true" on every statement: this project has the `safeupdate`
  -- Postgres extension enabled, which rejects any DELETE/UPDATE with no
  -- WHERE clause at all (raises "DELETE requires a WHERE clause") even
  -- from inside a security definer function. `where true` matches every
  -- row, so it deletes everything while satisfying that check.
  delete from payments where true;
  delete from complaints where true;
  delete from bookings where true;
  delete from vehicles where true;
  delete from customers where true;
  delete from audit_logs where true;

  insert into audit_logs (actor_id, action, entity_table, metadata)
  values (auth.uid(), 'test_data_reset', 'multiple', v_counts);

  return v_counts;
end;
$$;

revoke all on function admin_reset_all_test_data() from public;
grant execute on function admin_reset_all_test_data() to authenticated;

comment on function admin_reset_all_test_data() is 'TEMPORARY testing-phase helper (see migration header) — wipes bookings/payments/complaints/vehicles/customers/audit_logs so the admin dashboard can be reset to empty before go-live. super_admin only, checked inside the function itself. Drop this function and its UI once testing is done.';
