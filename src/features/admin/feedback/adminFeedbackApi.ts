import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'
import type { Database } from '@/types/database'

export type AdminFeedbackRow = Database['public']['Tables']['site_feedback']['Row']

export interface FeedbackSummary {
  feedback: AdminFeedbackRow[]
  count: number
  /** null when there is no feedback yet — a plain average of 0 would misleadingly read as "everyone rated us zero". */
  averageRating: number | null
}

/**
 * Read-only, same convention as adminPaymentsApi.fetchPayments — the only
 * writer of site_feedback is submit_site_feedback_public() (guest-facing,
 * Edge-Function-mediated); this dashboard never inserts/updates/deletes a
 * visitor's feedback.
 */
export async function fetchSiteFeedback(): Promise<FeedbackSummary> {
  const { data, error } = await supabase.from('site_feedback').select('*').order('created_at', { ascending: false })
  if (error) throw new AdminApiError(error.message)

  const feedback = (data ?? []) as AdminFeedbackRow[]
  const count = feedback.length
  const averageRating = count > 0 ? feedback.reduce((sum, row) => sum + row.rating, 0) / count : null

  return { feedback, count, averageRating }
}
