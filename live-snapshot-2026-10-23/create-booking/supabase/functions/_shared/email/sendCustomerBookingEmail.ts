import { getCustomerEmailContent, type CustomerBookingEventType } from './customerEmailContent.ts'
import { buildManageBookingUrl } from './manageBookingLink.ts'
import { buildOncePerBookingKey, buildRepeatableEventKey } from './idempotencyKey.ts'
import { renderCustomerLayout } from './layout.ts'
import { sendViaResend, type ResendConfig, type SendEmailResult } from './resendProvider.ts'
import type { CustomerRecipient } from './recipient.ts'
import type { BookingSummary } from './types.ts'
import type { EmailLanguage } from './strings.ts'

export interface EmailLogInsertRow {
  idempotency_key: string
  booking_id: string
  event_type: string
  recipient_type: 'customer'
  recipient_email: string
  language: EmailLanguage
  template: string
  subject: string
}

export interface EmailLogInsertResult {
  inserted: boolean
  id: string | null
}

export interface EmailLogStore {
  insertIfNew(row: EmailLogInsertRow): Promise<EmailLogInsertResult>
  markSent(id: string, providerMessageId: string | undefined): Promise<void>
  markFailed(id: string, failureReason: string): Promise<void>
}

export interface CustomerBookingEmailParams {
  eventType: CustomerBookingEventType
  bookingId: string
  bookingReference: string
  recipient: CustomerRecipient
  summary: BookingSummary
  language: EmailLanguage
  siteBaseUrl: string
  triggeringRowId?: string
}

export type SendCustomerEmailFn = (
  config: ResendConfig,
  params: { to: string; subject: string; html: string },
) => Promise<SendEmailResult>

export interface SendCustomerBookingEmailDeps {
  emailLog: EmailLogStore
  resendConfig: ResendConfig
  sendEmail?: SendCustomerEmailFn
}

export type SendOutcome =
  | { status: 'sent'; emailLogId: string; providerMessageId?: string }
  | { status: 'skipped_duplicate' }
  | { status: 'send_failed'; emailLogId: string; errorMessage: string }

export async function sendCustomerBookingEmailIdempotently(
  deps: SendCustomerBookingEmailDeps,
  params: CustomerBookingEmailParams,
): Promise<SendOutcome> {
  const content = getCustomerEmailContent(params.eventType, params.language)
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

  const idempotencyKey = params.triggeringRowId
    ? buildRepeatableEventKey(params.bookingId, params.eventType, params.triggeringRowId)
    : buildOncePerBookingKey(params.bookingId, params.eventType)

  const { inserted, id } = await deps.emailLog.insertIfNew({
    idempotency_key: idempotencyKey,
    booking_id: params.bookingId,
    event_type: params.eventType,
    recipient_type: 'customer',
    recipient_email: params.recipient.email,
    language: params.language,
    template: `customer_${params.eventType}`,
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
