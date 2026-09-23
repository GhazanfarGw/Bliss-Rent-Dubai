-- =============================================================================
-- Admin data reset — keep the real fleet (requested 2026-09-23)
--
-- admin_reset_all_test_data() (20260830000000_admin_reset_test_data.sql)
-- used to wipe the `vehicles` table along with everything else. The fleet
-- is now real, curated inventory (category split + per-vehicle specs work
-- since that migration), so clicking "Reset all test data" should no
-- longer delete it. This migration:
--
--   1. Stops touching real fleet vehicles (is_master_listing = true) —
--      those rows are left completely alone.
--   2. Still deletes booking-specific "Reserved copy" vehicle rows
--      (is_master_listing = false, Phase 14) — these only ever exist 1:1
--      with a booking and mean nothing once that booking is gone; leaving
--      them behind would clutter the Fleet list with orphaned RSV-xxxx
--      placeholder cars.
--   3. Also clears booking_extensions, vehicle_reassignments, and
--      email_log — three tables added (Phase 7 / Phase 9) after the
--      original reset function was written. Without this, that function
--      would now fail outright with a foreign-key violation on any
--      booking that has an extension or reassignment, since both
--      reference bookings/vehicles with "on delete restrict".
--
-- Same super_admin-only guard, same "where true" (required by the
-- `safeupdate` extension on every DELETE), same audit_logs row at the end.
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
  select role into v_role from admin_profiles where id = auth.uid();

  if v_role is distinct from 'super_admin' then
    raise exception 'Only a super_admin can reset test data';
  end if;

  select jsonb_build_object(
    'payments', (select count(*) from payments),
    'complaints', (select count(*) from complaints),
    'bookings', (select count(*) from bookings),
    'drivers', (select count(*) from drivers),
    'reserved_vehicle_copies', (select count(*) from vehicles where is_master_listing = false),
    'customers', (select count(*) from customers),
    'audit_logs', (select count(*) from audit_logs)
  ) into v_counts;

  -- Deletion order respects every "on delete restrict" FK standing after
  -- Phase 7/9/14: booking_extensions and vehicle_reassignments reference
  -- both bookings and vehicles with restrict, so they must go first.
  -- drivers, booking_status_history, booking_notifications, vehicle_images
  -- and pricing all cascade automatically from bookings/vehicles and do
  -- not need their own delete statement.
  delete from booking_extensions where true;
  delete from vehicle_reassignments where true;
  delete from payments where true;
  delete from complaints where true;
  delete from email_log where true;
  delete from bookings where true;
  -- Real fleet vehicles (is_master_listing = true) are deliberately
  -- excluded — only booking-specific Reserved copies are purged.
  delete from vehicles where is_master_listing = false;
  delete from customers where true;
  delete from audit_logs where true;

  insert into audit_logs (actor_id, action, entity_table, metadata)
  values (auth.uid(), 'test_data_reset', 'multiple', v_counts);

  return v_counts;
end;
$$;

revoke all on function admin_reset_all_test_data() from public;
grant execute on function admin_reset_all_test_data() to authenticated;

comment on function admin_reset_all_test_data() is 'TEMPORARY testing-phase helper — wipes bookings/payments/complaints/extensions/reassignments/email-log/customers/audit_logs, plus booking-specific Reserved-copy vehicle rows. Real fleet vehicles (is_master_listing = true) are never touched. super_admin only, checked inside the function itself. Drop this function and its UI once testing is done.';
