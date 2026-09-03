// Phase 9H — the complaint-notification equivalent of 9F's
// sendAdminOperationalEmail.ts. Deliberately a PARALLEL file, not a
// modification of that one: sendAdminOperationalEmail.ts's whole shape
// (AdminOperationalEmailParams.bookingId: string, non-optional) assumes a
// real booking backs every event. A Contact Us message may not (see
// 20260913000000_phase9h_submit_complaint.sql) — forcing a fake/empty
// bookingId through that file's existing, already-tested code path would
// be exactly the kind of silent behavior change this project has
// consistently avoided by building a small parallel file instead (the
// same reasoning 9E and 9F already applied to their own send functions).
//
// Reuses, completely unchanged: AdminEmailLogStore/AdminEmailLogInsertRow
// (booking_id is nullable there already — see 9F's own file), renderAdminLayout
// (Phase 9H's own additive extension: optional summary + detailsHtml),
// sendViaResend, buildAdminDashboardUrl, and adminRecipients.ts.

import { getComplaintNotificationContent } from './complaintNotificationContent.ts'
import { buildAdminDashboardUrl } from './adminDashboardLink.ts'
import { buildComplaintEventKey } from './idempotencyKey.ts'
import { renderAdminLayout } from './layout.ts'
import { renderDetailsCard } from './components.ts'
import { sendViaResend, type ResendConfig, type SendEmailResult } from './resendProvider.ts'
import type { AdminEmailLogStore } from './sendAdminOperationalEmail.ts'
import type { AdminRecipient } from './adminRecipients.ts'
import type { EmailLanguage } from './strings.ts'

const DETAIL_LABELS: Record<EmailLanguage, { subject: string; message: string; replyTo: string }> = {
  en: { subject: 'Subject', message: 'Message', replyTo: 'Reply-to' },
  ar: { subject: 'الموضوع', message: 'الرسالة', replyTo: 'الرد على' },
}

export type SendComplaintEmailFn = (
  config: ResendConfig,
  params: { to: string; subject: string; html: string },
) => Promise<SendEmailResult>

export interface SendComplaintNotificationEmailDeps {
  emailLog: AdminEmailLogStore
  resendConfig: ResendConfig
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendComplaintEmailFn
}

export interface ComplaintNotificationEmailParams {
  complaintId: string
  reporterName: string
  reporterEmail: string
  subject: string
  description: string
  recipient: AdminRecipient
  language: EmailLanguage
  siteBaseUrl: string
  dashboardPath: string
}

export type ComplaintSendOutcome =
  | { status: 'sent'; emailLogId: string; providerMessageId?: string }
  | { status: 'skipped_duplicate' }
  | { status: 'send_failed'; emailLogId: string; errorMessage: string }

export async function sendComplaintNotificationEmailIdempotently(
  deps: SendComplaintNotificationEmailDeps,
  params: ComplaintNotificationEmailParams,
): Promise<ComplaintSendOutcome> {
  const content = getComplaintNotificationContent(params.language)
  const labels = DETAIL_LABELS[params.language]
  const dashboardUrl = buildAdminDashboardUrl(params.siteBaseUrl, params.dashboardPath)

  const detailsHtml = renderDetailsCard(
    [
      { label: labels.subject, value: params.subject },
      { label: labels.message, value: params.description },
      { label: labels.replyTo, value: params.reporterEmail, ltrValue: true },
    ],
    params.language,
  )

  const html = renderAdminLayout({
    language: params.language,
    alertType: content.alertType,
    priority: content.priority,
    customerName: params.reporterName,
    requiredAction: content.requiredAction,
    detailsHtml,
    dashboardUrl,
  })

  const idempotencyKey = buildComplaintEventKey(params.complaintId, 'admin_complaint_received', params.recipient.id)

  const { inserted, id } = await deps.emailLog.insertIfNew({
    idempotency_key: idempotencyKey,
    booking_id: null,
    event_type: 'admin_complaint_received',
    recipient_type: 'admin',
    recipient_email: params.recipient.email,
    language: params.language,
    template: 'admin_complaint_received',
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
