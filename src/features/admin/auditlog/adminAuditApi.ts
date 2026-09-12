import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'
import type { AdminAuditLogEntry } from '@/types/domain'

const PAGE_SIZE = 50

/**
 * Read-only view onto the existing audit_logs table (Phase 0 architecture,
 * populated by the Phase 3 triggers on vehicles/pricing/complaints/booking
 * status). No new logging mechanism here — this page only reads.
 */
export async function fetchAuditLog(entityTable?: string): Promise<AdminAuditLogEntry[]> {
  let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE)
  if (entityTable) query = query.eq('entity_table', entityTable)

  const { data, error } = await query
  if (error) throw new AdminApiError(error.message)
  return data ?? []
}
