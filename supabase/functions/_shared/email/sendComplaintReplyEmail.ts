// Task 3 (2026-09-11 scoped update) — sends the `admin_complaint_reply`
// customer email: the one new direction this task adds (admin -> customer)
// on top of Phase 9H's existing customer -> admin complaint pipeline.
//
// Deliberately its own small parallel file, not a change to
// sendCustomerBookingEmail.ts or sendComplaintNotificationEmail.ts — same
// reasoning those two already documented for each other: a Contact Us
// complaint may have no booking (EmailLogInsertRow.booking_id is
// required there), and this is a 'customer' recipient, not 'admin'
// (AdminEmailLogInsertRow.recipient_type is literally typed 'admin').
// Neither existing shape fits, so this defines its own — reusing
// everything else (renderCustomerLayout, renderDetailsCard, sendViaResend,
// the email_log table itself) completely unchanged.

import { getComplaintReplyContent } from './complaintReplyContent.ts'
import { renderCustomerLayout } from './layout.ts'
import { renderDetailsCard } from './components.ts'
import { buildComplaintEventKey } from './idempotencyKey.ts'
import { sendViaResend, type ResendConfig, type SendEmailResult } from './resendProvider.ts'
import type { CustomerRecipient } from './recipient.ts'
import type { EmailLanguage } from './strings.ts'

export interface ComplaintReplyEmailLogInsertRow {
  idempotency_key: string
  /** Nullable — a Contact Us complaint may not reference any one booking (see submit_complaint_public()). */
  booking_id: string | null
  event_type: string
  recipient_type: 'customer'
  recipient_email: string
  language: EmailLanguage
  template: string
  subject: string
}

export interface ComplaintReplyEmailLogInsertResult {
  inserted: boolean
  id: string | null
}

export interface ComplaintReplyEmailLogStore {
  insertIfNew(row: ComplaintReplyEmailLogInsertRow): Promise<ComplaintReplyEmailLogInsertResult>
  markSent(id: string, providerMessageId: string | undefined): Promise<void>
  markFailed(id: string, failureReason: string): Promise<void>
}

export type SendComplaintReplyEmailFn = (
  config: ResendConfig,
  params: { to: string; subject: string; html: string },
) => Promise<SendEmailResult>

export interface SendComplaintReplyEmailDeps {
  emailLog: ComplaintReplyEmailLogStore
  resendConfig: ResendConfig
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendComplaintReplyEmailFn
}

export interface ComplaintReplyEmailParams {
  complaintId: string
  bookingId: string | null
  recipient: CustomerRecipient
  originalSubject: string
  originalMessage: string
  replyMessage: string
  /** The complaint's admin_reply_sent_at, ISO string — the idempotency discriminator (see the migration comment on that column). */
  replySentAt: string
  language: EmailLanguage
  siteBaseUrl: string
}

export type ComplaintReplySendOutcome =
  | { status: 'sent'; emailLogId: string; providerMessageId?: string }
  | { status: 'skipped_duplicate' }
  | { status: 'send_failed'; emailLogId: string; errorMessage: string }

export async function sendComplaintReplyEmailIdempotently(
  deps: SendComplaintReplyEmailDeps,
  params: ComplaintReplyEmailParams,
): Promise<ComplaintReplySendOutcome> {
  const content = getComplaintReplyContent(params.language)

  const detailsHtml = renderDetailsCard(
    [
      { label: content.yourMessageLabel, value: params.originalMessage },
      { label: content.ourReplyLabel, value: params.replyMessage },
    ],
    params.language,
  )

  const html = renderCustomerLayout({
    language: params.language,
    title: content.title,
    message: content.message,
    statusTone: 'info',
    statusMessage: content.statusMessage,
    extraContentHtml: detailsHtml,
    ctaUrl: params.siteBaseUrl,
    ctaLabel: content.ctaLabel,
  })

  const idempotencyKey = buildComplaintEventKey(params.complaintId, 'admin_complaint_reply', params.replySentAt)

  const { inserted, id } = await deps.emailLog.insertIfNew({
    idempotency_key: idempotencyKey,
    booking_id: params.bookingId,
    event_type: 'admin_complaint_reply',
    recipient_type: 'customer',
    recipient_email: params.recipient.email,
    language: params.language,
    template: 'admin_complaint_reply',
    subject: content.subject,
  })

  if (!inserted || !id) {
    return { status: 'skipped_duplicate' }
  }

  const send = deps.sendEmail ?? sendViaResend
  const result = await send(deps.resendConfig, { to: params.recipient.email, subject: content.subject, html })

  if (result.ok) {
    await deps.emailLog.markSent(id, result.providerMessageId)
    return { status: 'sent', emailLogId: id, providerMessageId: result.providerMessageId }
  }

  const errorMessage = result.errorMessage ?? 'unknown error'
  await deps.emailLog.markFailed(id, errorMessage)
  return { status: 'send_failed', emailLogId: id, errorMessage }
}
