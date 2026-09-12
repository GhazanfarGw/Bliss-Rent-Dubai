// Task 3 — fetches exactly what deliver-complaint-reply needs, straight
// from the database: the complaint's own recorded reply text/timestamp
// (never trusted from the request body — same "recipient/content always
// resolved server-side" posture as bookingEmailData.ts) plus the
// customer to send it to.

import type { CustomerRecipientSource } from './recipient.ts'

export interface ComplaintReplyRow {
  id: string
  booking_id: string | null
  subject: string
  description: string
  admin_reply_message: string | null
  admin_reply_sent_at: string | null
  customers: CustomerRecipientSource | null
}

/** Narrow slice of the supabase-js client surface this module needs — same convention as BookingEmailDataSource. */
export interface ComplaintReplyDataSource {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: ComplaintReplyRow | null; error: { message: string } | null }>
      }
    }
  }
}

export const COMPLAINT_REPLY_SELECT =
  'id, booking_id, subject, description, admin_reply_message, admin_reply_sent_at, customers(full_name, email)'

export class ComplaintReplyDataError extends Error {}

export async function fetchComplaintReplyRow(supabase: ComplaintReplyDataSource, complaintId: string): Promise<ComplaintReplyRow> {
  const { data, error } = await supabase.from('complaints').select(COMPLAINT_REPLY_SELECT).eq('id', complaintId).maybeSingle()
  if (error) throw new ComplaintReplyDataError(`fetchComplaintReplyRow: ${error.message}`)
  if (!data) throw new ComplaintReplyDataError(`fetchComplaintReplyRow: no complaint found for id ${complaintId}`)
  return data
}
