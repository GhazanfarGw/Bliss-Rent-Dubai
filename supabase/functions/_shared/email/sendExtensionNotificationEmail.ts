// Phase 9E — idempotent send for one extension/reassignment customer
// email. Deliberately a separate, parallel function from 9D's
// sendCustomerBookingEmail.ts rather than a modification of it: that file
// is already-approved, shipped Phase 9D code, and the 9E instruction is
// to reuse the Phase 9B *design system* (layout.ts/components.ts/
// brand.ts/strings.ts/escape.ts — all imported below, unchanged) — not to
// alter 9D's own orchestration. The two functions share the same shape by
// convention, not by inheritance.
//
// CONCURRENCY: identical guarantee to 9D — EmailLogStore.insertIfNew is a
// single atomic upsert (see supabaseEmailLogStore.ts), never a
// select-then-insert. The idempotency key here is always the REPEATABLE
// shape (buildRepeatableEventKey, keyed on the triggering
// booking_notifications row's own id) because, unlike 9D's 4 booking
// events, every one of these 4 notification types can legitimately recur
// for the same booking over its lifetime (a booking can be extended, and
// therefore reassigned or rejected, more than once).

import { getExtensionNotificationContent, type ExtensionNotificationType } from './extensionNotificationContent.ts'
import { buildManageBookingUrl } from './manageBookingLink.ts'
import { buildRepeatableEventKey } from './idempotencyKey.ts'
import { renderCustomerLayout } from './layout.ts'
import { sendViaResend, type ResendConfig, type SendEmailResult } from './resendProvider.ts'
import type { EmailLogStore, EmailLogInsertRow, SendCustomerEmailFn } from './sendCustomerBookingEmail.ts'
import type { CustomerRecipient } from './recipient.ts'
import type { BookingSummary } from './types.ts'
import type { EmailLanguage } from './strings.ts'

export interface ExtensionNotificationEmailParams {
  notificationId: string
  notificationType: ExtensionNotificationType
  bookingId: string
  bookingReference: string
  payload: Record<string, unknown>
  recipient: CustomerRecipient
  summary: BookingSummary
  language: EmailLanguage
  siteBaseUrl: string
}

export interface SendExtensionNotificationDeps {
  emailLog: EmailLogStore
  resendConfig: ResendConfig
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendCustomerEmailFn
}

export type ExtensionSendOutcome =
  | { status: 'sent'; emailLogId: string; providerMessageId?: string }
  | { status: 'skipped_duplicate' }
  | { status: 'send_failed'; emailLogId: string; errorMessage: string }

export async function sendExtensionNotificationEmailIdempotently(
  deps: SendExtensionNotificationDeps,
  params: ExtensionNotificationEmailParams,
): Promise<ExtensionSendOutcome> {
  const content = getExtensionNotificationContent(params.notificationType, params.language, params.payload)
  const ctaUrl = buildManageBookingUrl(params.siteBaseUrl, params.bookingReference)

  const html = renderCustomerLayout({
    language: params.language,
    title: content.title,
    message: content.message,
    statusTone: content.statusTone,
    statusMessage: content.statusMessage,
    summary: params.summary,
    ctaUrl,
  })

  const idempotencyKey = buildRepeatableEventKey(params.bookingId, params.notificationType, params.notificationId)

  const row: EmailLogInsertRow = {
    idempotency_key: idempotencyKey,
    booking_id: params.bookingId,
    event_type: params.notificationType,
    recipient_type: 'customer',
    recipient_email: params.recipient.email,
    language: params.language,
    template: `extension_${params.notificationType}`,
    subject: content.subject,
  }

  const { inserted, id } = await deps.emailLog.insertIfNew(row)
  if (!inserted || !id) {
    return { status: 'skipped_duplicate' }
  }

  const send = deps.sendEmail ?? sendViaResend
  const result: SendEmailResult = await send(deps.resendConfig, { to: params.recipient.email, subject: content.subject, html })

  if (result.ok) {
    await deps.emailLog.markSent(id, result.providerMessageId)
    return { status: 'sent', emailLogId: id, providerMessageId: result.providerMessageId }
  }

  const errorMessage = result.errorMessage ?? 'unknown error'
  await deps.emailLog.markFailed(id, errorMessage)
  return { status: 'send_failed', emailLogId: id, errorMessage }
}
