import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'
import type { AdminEmailLogEntry, AdminEmailPreviewCatalogEntry } from '@/types/domain'
import type { EmailDeliveryStatus, EmailLanguageCode, EmailRecipientType } from '@/types/database'

const PAGE_SIZE = 50

/**
 * Phase 9J — Admin Email Management dashboard.
 *
 * Two unrelated jobs live in this one file, mirroring the two things this
 * screen shows:
 *
 *  1. Reading `email_log` (9C) — a plain read through the same anon-key
 *     client every other admin*Api.ts file uses. The existing "admins
 *     read email log" RLS policy (20260911000000_phase9_email_log_table.sql)
 *     already allows this; nothing new is granted here. Read-only, same
 *     as fetchAuditLog — this dashboard cannot edit or resend a
 *     historical email_log row, only see it.
 *
 *  2. Calling the preview-send-email Edge Function (9I) for the
 *     Templates tab — 'catalog' to list what it can render, 'preview'
 *     to render one against fake QA data, 'send' to actually test-send
 *     one (server-side gated behind TEST_MODE + an allowlist regardless
 *     of who calls it — see testModeConfig.ts). None of these three
 *     calls ever touches email_log.
 */

export interface EmailLogFilters {
  status?: EmailDeliveryStatus
  eventType?: string
  recipientType?: EmailRecipientType
  language?: EmailLanguageCode
  /** Matched against recipient_email with a case-insensitive partial match. */
  recipientSearch?: string
}

export async function fetchEmailLog(filters: EmailLogFilters = {}): Promise<AdminEmailLogEntry[]> {
  let query = supabase.from('email_log').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.eventType) query = query.eq('event_type', filters.eventType)
  if (filters.recipientType) query = query.eq('recipient_type', filters.recipientType)
  if (filters.language) query = query.eq('language', filters.language)
  if (filters.recipientSearch?.trim()) query = query.ilike('recipient_email', `%${filters.recipientSearch.trim()}%`)

  const { data, error } = await query
  if (error) throw new AdminApiError(error.message)
  return data ?? []
}

/** Every distinct event_type currently in email_log — used to populate the Event type filter without hardcoding the (growing) event catalog. */
export async function fetchEmailLogEventTypes(): Promise<string[]> {
  const { data, error } = await supabase.from('email_log').select('event_type').limit(1000)
  if (error) throw new AdminApiError(error.message)
  const types = new Set((data ?? []).map((row) => row.event_type))
  return Array.from(types).sort()
}

async function invokePreviewSendEmail<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('preview-send-email', { body })
  if (error) {
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const parsed = await context.clone().json()
        throw new AdminApiError(parsed.message ?? 'The email preview tool could not complete that request.')
      } catch (parseError) {
        if (parseError instanceof AdminApiError) throw parseError
        // fall through to the generic error below
      }
    }
    throw new AdminApiError(error.message)
  }
  return data as T
}

export async function fetchEmailPreviewCatalog(): Promise<AdminEmailPreviewCatalogEntry[]> {
  const result = await invokePreviewSendEmail<{ mode: 'catalog'; catalog: AdminEmailPreviewCatalogEntry[] }>({ mode: 'catalog' })
  return result.catalog
}

export async function fetchEmailPreviewHtml(category: string, eventType: string, language: EmailLanguageCode): Promise<string> {
  const result = await invokePreviewSendEmail<{ mode: 'preview'; html: string }>({ mode: 'preview', category, eventType, language })
  return result.html
}

export async function sendTestEmail(
  category: string,
  eventType: string,
  language: EmailLanguageCode,
  recipientEmail: string,
): Promise<{ mode: 'send'; sent: true; providerMessageId?: string }> {
  return invokePreviewSendEmail<{ mode: 'send'; sent: true; providerMessageId?: string }>({
    mode: 'send',
    category,
    eventType,
    language,
    recipientEmail,
  })
}
