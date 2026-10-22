// "Get a quote" form — notifies every active admin that a new quote
// request (lead) arrived. Parallel to deliverComplaintNotification.ts for
// the same reason that file is parallel to the booking pipeline: a quote
// request has no booking. Reuses resolveAdminRecipients, renderAdminLayout,
// renderDetailsCard, sendViaResend and the admin email_log store as-is.
//
// NEVER throws (see triggerQuoteNotification): the lead is already stored
// by the time this runs, so an email problem must not fail the guest's
// submission.

import { resolveAdminRecipients, type ActiveAdminsSource, type GetAdminEmailFn } from './adminRecipients.ts'
import { buildAdminDashboardUrl } from './adminDashboardLink.ts'
import { renderAdminLayout } from './layout.ts'
import { renderDetailsCard } from './components.ts'
import { sendViaResend, type ResendConfig, type SendEmailResult } from './resendProvider.ts'
import type { AdminEmailLogStore } from './sendAdminOperationalEmail.ts'

export interface QuoteDetails {
  leadId: string
  fullName: string
  phone: string
  email?: string | null
  carInterest?: string | null
  startDate?: string | null
  endDate?: string | null
  notes?: string | null
  source?: string | null
}

export interface TriggerQuoteNotificationParams {
  adminsSource: ActiveAdminsSource
  getAdminEmail: GetAdminEmailFn
  emailLog: AdminEmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  quote: QuoteDetails
  sendEmail?: (config: ResendConfig, params: { to: string; subject: string; html: string }) => Promise<SendEmailResult>
}

const EVENT = 'admin_quote_requested'

export function buildQuoteEmailHtml(quote: QuoteDetails, dashboardUrl: string): { subject: string; html: string } {
  const waDigits = quote.phone.replace(/\D/g, '')
  const rows: { label: string; value: string; ltrValue?: boolean }[] = [
    { label: 'Phone / WhatsApp', value: quote.phone, ltrValue: true },
    { label: 'WhatsApp link', value: `https://wa.me/${waDigits}`, ltrValue: true },
  ]
  if (quote.email) rows.push({ label: 'Email', value: quote.email, ltrValue: true })
  if (quote.carInterest) rows.push({ label: 'Car', value: quote.carInterest })
  if (quote.startDate || quote.endDate) rows.push({ label: 'Dates', value: `${quote.startDate ?? '?'} → ${quote.endDate ?? '?'}`, ltrValue: true })
  if (quote.notes) rows.push({ label: 'Notes', value: quote.notes })
  if (quote.source) rows.push({ label: 'Source', value: quote.source })

  const subject = `New quote request — ${quote.fullName}${quote.carInterest ? ` (${quote.carInterest})` : ''}`
  const html = renderAdminLayout({
    language: 'en',
    alertType: 'New quote request',
    priority: 'urgent',
    customerName: quote.fullName,
    requiredAction: 'Reply on WhatsApp within 5 minutes with price and availability.',
    detailsHtml: renderDetailsCard(rows, 'en'),
    dashboardUrl,
  })
  return { subject, html }
}

export async function triggerQuoteNotification(params: TriggerQuoteNotificationParams): Promise<void> {
  try {
    const admins = await resolveAdminRecipients(params.adminsSource, params.getAdminEmail)
    const { subject, html } = buildQuoteEmailHtml(params.quote, buildAdminDashboardUrl(params.siteBaseUrl, '/admin'))
    const send = params.sendEmail ?? sendViaResend

    for (const admin of admins) {
      try {
        const { inserted, id } = await params.emailLog.insertIfNew({
          idempotency_key: `lead:${params.quote.leadId}:${EVENT}:${admin.id}`,
          booking_id: null,
          event_type: EVENT,
          recipient_type: 'admin',
          recipient_email: admin.email,
          language: 'en',
          template: EVENT,
          subject,
        })
        if (!inserted || !id) continue
        const result = await send(params.resendConfig, { to: admin.email, subject, html })
        if (result.ok) await params.emailLog.markSent(id, result.providerMessageId)
        else await params.emailLog.markFailed(id, result.errorMessage ?? 'unknown error')
      } catch (err) {
        console.error(`${EVENT} send failed for ${admin.email}`, err)
      }
    }
  } catch (err) {
    console.error(`${EVENT} notification failed`, err)
  }
}
