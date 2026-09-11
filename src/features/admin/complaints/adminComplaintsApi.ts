import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'
import type { AdminComplaintWithDetails } from '@/types/domain'
import type { Database } from '@/types/database'

type ComplaintStatus = Database['public']['Tables']['complaints']['Row']['status']

const COMPLAINT_SELECT = '*, customers(*), bookings(*)'

export async function fetchComplaints(status: ComplaintStatus | 'all'): Promise<AdminComplaintWithDetails[]> {
  let query = supabase.from('complaints').select(COMPLAINT_SELECT).order('created_at', { ascending: false })
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new AdminApiError(error.message)
  return (data ?? []) as unknown as AdminComplaintWithDetails[]
}

export async function fetchComplaintById(id: string): Promise<AdminComplaintWithDetails | null> {
  const { data, error } = await supabase.from('complaints').select(COMPLAINT_SELECT).eq('id', id).maybeSingle()
  if (error) throw new AdminApiError(error.message)
  return data as unknown as AdminComplaintWithDetails | null
}

export interface ComplaintUpdate {
  status: ComplaintStatus
  internalNotes: string
  resolution: string
}

/**
 * Plain RLS-governed update — "admins manage complaints" already covers
 * this; the complaints_audit trigger logs any status change automatically.
 * resolved_at is stamped here (not by a trigger) because it only applies
 * on the transition INTO resolved/closed, which is simplest to express
 * where the intent is known rather than re-derived in SQL.
 */
export async function updateComplaint(id: string, update: ComplaintUpdate): Promise<void> {
  const isResolvedNow = update.status === 'resolved' || update.status === 'closed'
  const { error } = await supabase
    .from('complaints')
    .update({
      status: update.status,
      internal_notes: update.internalNotes || null,
      resolution: update.resolution || null,
      resolved_at: isResolvedNow ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) throw new AdminApiError(error.message)
}

export interface SendComplaintReplyResult {
  /** Whether the best-effort email-delivery trigger appears to have succeeded — never blocks the (already-saved) reply on a delivery problem; a failure here is only logged (see console.error below), same fire-and-forget convention as adminConfirmBookingVehicle's notification trigger. */
  emailTriggered: boolean
}

/**
 * Task 3 (2026-09-11 scoped update) — activates the Contact Us -> admin
 * reply -> customer email flow. Two steps, same pattern as
 * adminConfirmBookingVehicle:
 *  1. A plain RLS-governed update ("admins manage complaints" already
 *     covers this, same as updateComplaint above) saves the reply text
 *     and stamps admin_reply_sent_at — this is the durable, already-
 *     successful part; a customer can always see it was saved even if
 *     step 2 below has trouble.
 *  2. Best-effort (never throwing) triggers deliver-complaint-reply,
 *     which re-reads the just-saved text/timestamp from the database
 *     (never from this call's arguments) and emails the customer,
 *     idempotently keyed on admin_reply_sent_at — see that Edge
 *     Function's own header for why.
 */
export async function sendComplaintReply(id: string, replyMessage: string): Promise<SendComplaintReplyResult> {
  const message = replyMessage.trim()
  const { error } = await supabase
    .from('complaints')
    .update({ admin_reply_message: message, admin_reply_sent_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new AdminApiError(error.message)

  try {
    const { error: notifyError } = await supabase.functions.invoke('deliver-complaint-reply', {
      body: { complaintId: id },
    })
    if (notifyError) {
      console.error('deliver-complaint-reply failed', notifyError)
      return { emailTriggered: false }
    }
  } catch (err) {
    console.error('deliver-complaint-reply failed', err)
    return { emailTriggered: false }
  }

  return { emailTriggered: true }
}
