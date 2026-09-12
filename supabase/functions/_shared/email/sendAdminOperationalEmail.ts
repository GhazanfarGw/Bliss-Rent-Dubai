// Phase 9F — the admin-email equivalent of 9D's
// sendCustomerBookingEmail.ts. Deliberately a PARALLEL file, not a
// modification of that one — same reasoning 9E already applied to
// sendExtensionNotificationEmail.ts: reusing sendCustomerBookingEmail.ts
// would mean widening its `recipient_type: 'customer'` literal (and the
// EmailLogStore/EmailLogInsertRow types built around it) inside an
// already-shipped, approved 9D file. A small parallel type set here
// keeps 9D's own file, and everything that already depends on its exact
// shape, completely untouched.
//
// CONCURRENCY SAFETY: identical to sendCustomerBookingEmail.ts — see that
// file's header. `AdminEmailLogStore.insertIfNew` is contracted to be one
// atomic upsert against the SAME email_log_idempotency_key_idx unique
// index from Phase 9C; there is no separate exists-check anywhere in
// this file.
//
// IDEMPOTENCY KEY SHAPE: every admin operational event fans out to
// MULTIPLE recipients (see adminRecipients.ts / deliverAdminOperationalEmails.ts),
// so the key must vary per admin as well as per booking/event — otherwise
// the first admin's send would "claim" the key and every other admin
// would be silently skipped as a duplicate. This reuses
// buildRepeatableEventKey(bookingId, eventType, discriminator) from 9C's
// idempotencyKey.ts UNCHANGED: the discriminator is the recipient's own
// admin_profiles id (unique per admin), or — for an event whose
// real-world occurrence can itself repeat for the same booking, e.g. a
// booking submitting more than one extension request over its lifetime —
// `${triggeringRowId}:${recipientId}` (folding the triggering row's own
// id in ahead of the recipient id, so two different admins for the SAME
// occurrence still get distinct keys, and the SAME admin for two
// DIFFERENT occurrences also gets distinct keys).

import { getAdminOperationalEmailContent, type AdminOperationalEventType } from './adminOperationalEmailContent.ts'
import { buildAdminDashboardUrl } from './adminDashboardLink.ts'
import { buildRepeatableEventKey } from './idempotencyKey.ts'
import { renderAdminLayout } from './layout.ts'
import { sendViaResend, type ResendConfig, type SendEmailResult } from './resendProvider.ts'
import type { AdminRecipient } from './adminRecipients.ts'
import type { BookingSummary } from './types.ts'
import type { EmailLanguage } from './strings.ts'

export interface AdminEmailLogInsertRow {
  idempotency_key: string
  booking_id: string | null
  event_type: string
  recipient_type: 'admin'
  recipient_email: string
  language: EmailLanguage
  template: string
  subject: string
}

export interface AdminEmailLogInsertResult {
  inserted: boolean
  id: string | null
}

export interface AdminEmailLogStore {
  insertIfNew(row: AdminEmailLogInsertRow): Promise<AdminEmailLogInsertResult>
  markSent(id: string, providerMessageId: string | undefined): Promise<void>
  markFailed(id: string, failureReason: string): Promise<void>
}

export type SendAdminEmailFn = (
  config: ResendConfig,
  params: { to: string; subject: string; html: string },
) => Promise<SendEmailResult>

export interface SendAdminOperationalEmailDeps {
  emailLog: AdminEmailLogStore
  resendConfig: ResendConfig
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendAdminEmailFn
}

export interface AdminOperationalEmailParams {
  eventType: AdminOperationalEventType
  bookingId: string
  customerName: string
  summary: BookingSummary
  recipient: AdminRecipient
  language: EmailLanguage
  siteBaseUrl: string
  /** Which admin route this email's CTA opens — e.g. `/admin/bookings/${bookingId}` or `/admin/extensions`. */
  dashboardPath: string
  /**
   * Only meaningful for an event whose real-world occurrence can repeat
   * for the same booking (today, only admin_extension_requested — a
   * booking can have more than one extension request over its
   * lifetime). Omit for a once-per-booking event.
   */
  triggeringRowId?: string
}

export type AdminSendOutcome =
  | { status: 'sent'; emailLogId: string; providerMessageId?: string }
  | { status: 'skipped_duplicate' }
  | { status: 'send_failed'; emailLogId: string; errorMessage: string }

export async function sendAdminOperationalEmailIdempotently(
  deps: SendAdminOperationalEmailDeps,
  params: AdminOperationalEmailParams,
): Promise<AdminSendOutcome> {
  const content = getAdminOperationalEmailContent(params.eventType, params.language)
  const dashboardUrl = buildAdminDashboardUrl(params.siteBaseUrl, params.dashboardPath)

  const html = renderAdminLayout({
    language: params.language,
    alertType: content.alertType,
    priority: content.priority,
    summary: params.summary,
    customerName: params.customerName,
    requiredAction: content.requiredAction,
    dashboardUrl,
  })

  const keyDiscriminator = params.triggeringRowId
    ? `${params.triggeringRowId}:${params.recipient.id}`
    : params.recipient.id
  const idempotencyKey = buildRepeatableEventKey(params.bookingId, params.eventType, keyDiscriminator)

  const { inserted, id } = await deps.emailLog.insertIfNew({
    idempotency_key: idempotencyKey,
    booking_id: params.bookingId,
    event_type: params.eventType,
    recipient_type: 'admin',
    recipient_email: params.recipient.email,
    language: params.language,
    template: `admin_${params.eventType}`,
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
