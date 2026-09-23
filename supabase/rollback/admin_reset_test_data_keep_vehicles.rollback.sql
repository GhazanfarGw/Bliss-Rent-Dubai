-- Undo supabase/migrations/20260923000000_admin_reset_test_data_keep_vehicles.sql.
-- Restores admin_reset_all_test_data() to its original 20260830000000 body,
-- which deletes ALL vehicles (not just Reserved copies) and does not clear
-- booking_extensions/vehicle_reassignments/email_log. Running the "Reset
-- all test data" button after this rollback would once again wipe the
-- fleet and would fail with a foreign-key violation on any booking that
-- has an extension or reassignment recorded against it.

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
    'vehicles', (select count(*) from vehicles),
    'customers', (select count(*) from customers),
    'audit_logs', (select count(*) from audit_logs)
  ) into v_counts;

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
