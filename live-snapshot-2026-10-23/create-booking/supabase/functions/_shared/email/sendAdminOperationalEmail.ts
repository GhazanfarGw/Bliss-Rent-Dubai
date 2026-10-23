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
  dashboardPath: string
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
