import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'
import type { AdminProfile } from '@/types/domain'
import type { AdminRole } from '@/types/database'

/**
 * The Staff Accounts screen (super_admin only — see StaffAccountsPage.tsx
 * and supabase/migrations/20260901000000_staff_account_control.sql).
 *
 * Reads (fetchStaffDirectory) go through the ordinary anon-key client like
 * every other admin*Api.ts file — the existing "admins read all admin
 * profiles" RLS policy already allows this. Role/active-status changes
 * also go through the anon-key client as plain table updates: as of the
 * 20260901000000 migration, admin_profiles writes are restricted to
 * super_admin by RLS itself, plus a guard trigger that blocks self-changes
 * and protects the last remaining active owner — so there is nothing extra
 * for this file to enforce, it can just ask and let the database say no
 * when it should.
 *
 * Creating a brand-new login is the one exception: that needs the
 * service-role key (to create a Supabase Auth user), which this client
 * never holds, so createStaffAccount calls the admin-create-staff Edge
 * Function instead — see supabase/functions/admin-create-staff.
 */
export async function fetchStaffDirectory(): Promise<AdminProfile[]> {
  const { data, error } = await supabase.from('admin_profiles').select('*').order('full_name')
  if (error) throw new AdminApiError(error.message)
  return data ?? []
}

export async function setStaffActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('admin_profiles').update({ is_active: isActive }).eq('id', id)
  if (error) throw new AdminApiError(error.message)
}

export async function setStaffRole(id: string, role: AdminRole): Promise<void> {
  const { error } = await supabase.from('admin_profiles').update({ role }).eq('id', id)
  if (error) throw new AdminApiError(error.message)
}

export interface CreateStaffInput {
  fullName: string
  email: string
  password: string
}

export interface CreateStaffResult {
  id: string
  fullName: string
  email: string
  role: 'staff'
}

export async function createStaffAccount(input: CreateStaffInput): Promise<CreateStaffResult> {
  const { data, error } = await supabase.functions.invoke('admin-create-staff', { body: input })
  if (error) {
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const parsed = await context.clone().json()
        throw new AdminApiError(parsed.message ?? 'Could not create the staff account.', parsed.fieldErrors)
      } catch (parseError) {
        if (parseError instanceof AdminApiError) throw parseError
        // fall through to the generic error below
      }
    }
    throw new AdminApiError(error.message)
  }
  return data as CreateStaffResult
}

/** A random, easy-to-read temporary password to suggest when adding a staff member — the owner can edit it before creating the account. Not cryptographically exhaustive; just long and mixed enough to not be a trivial guess, since it's meant to be replaced by the staff member's own password on first real use once Phase 7 adds self-service password reset. */
export function generateTempPassword(): string {
  const words = ['bliss', 'dubai', 'rental', 'airport', 'drive', 'palm', 'marina', 'oasis']
  const word = words[Math.floor(Math.random() * words.length)]
  const digits = Math.floor(1000 + Math.random() * 9000)
  const symbols = ['!', '#', '$', '%', '*']
  const symbol = symbols[Math.floor(Math.random() * symbols.length)]
  return `${word[0].toUpperCase()}${word.slice(1)}${digits}${symbol}`
}
