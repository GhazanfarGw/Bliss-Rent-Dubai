import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'

// The staff directory (fetchStaffDirectory) and account-control actions
// (create/suspend/promote) now live in
// src/features/admin/staff/staffApi.ts, behind the dedicated Staff
// Accounts screen — see supabase/migrations/20260901000000_staff_account_control.sql.

export interface ResetTestDataCounts {
  payments: number
  complaints: number
  bookings: number
  drivers: number
  vehicles: number
  customers: number
  audit_logs: number
}

/**
 * TEMPORARY — testing-phase only. Calls admin_reset_all_test_data()
 * (supabase/migrations/20260830000000_admin_reset_test_data.sql), which
 * wipes every booking/payment/complaint/vehicle/customer/audit-log row.
 * The function itself re-checks super_admin server-side, so this is safe
 * to call even if the UI gate is ever bypassed — it will just error.
 *
 * Remove this function (and its "Danger Zone" caller in
 * AdminSettingsPage.tsx) once testing is done and the team goes live.
 */
export async function resetAllTestData(): Promise<ResetTestDataCounts> {
  const { data, error } = await supabase.rpc('admin_reset_all_test_data')
  if (error) throw new AdminApiError(error.message)
  return data as ResetTestDataCounts
}
