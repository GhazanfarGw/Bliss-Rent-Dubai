import { fetchBookingEmailRow, buildBookingSummaryFromRow, type BookingEmailDataSource } from './bookingEmailData.ts'
import { resolveAdminRecipients, type ActiveAdminsSource, type GetAdminEmailFn } from './adminRecipients.ts'
import {
  sendAdminOperationalEmailIdempotently,
  type AdminEmailLogStore,
  type SendAdminEmailFn,
  type AdminSendOutcome,
} from './sendAdminOperationalEmail.ts'
import type { AdminOperationalEventType } from './adminOperationalEmailContent.ts'
import type { ResendConfig } from './resendProvider.ts'
import type { EmailLanguage } from './strings.ts'

export interface DeliverAdminOperationalEmailsDataSource extends BookingEmailDataSource, ActiveAdminsSource {}

export interface DeliverAdminOperationalEmailsDeps {
  dataSource: DeliverAdminOperationalEmailsDataSource
  getAdminEmail: GetAdminEmailFn
  emailLog: AdminEmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  sendEmail?: SendAdminEmailFn
}

export interface DeliverAdminOperationalEmailsParams {
  bookingId: string
  eventType: AdminOperationalEventType
  language: EmailLanguage
  dashboardPath: string
  triggeringRowId?: string
}

export type DeliveredAdminEmailOutcome =
  | ({ recipientEmail: string } & AdminSendOutcome)
  | { recipientEmail: string; status: 'skipped_error'; errorMessage: string }

export async function deliverAdminOperationalEmails(
  deps: DeliverAdminOperationalEmailsDeps,
  params: DeliverAdminOperationalEmailsParams,
): Promise<DeliveredAdminEmailOutcome[]> {
  const row = await fetchBookingEmailRow(deps.dataSource, params.bookingId)
  const summary = buildBookingSummaryFromRow(row)
  const customerName = row.customers?.full_name?.trim() || 'Customer'

  const admins = await resolveAdminRecipients(deps.dataSource, deps.getAdminEmail)
  if (admins.length === 0) {
    return []
  }

  const outcomes: DeliveredAdminEmailOutcome[] = []
  for (const admin of admins) {
    try {
      const outcome = await sendAdminOperationalEmailIdempotently(
        { emailLog: deps.emailLog, resendConfig: deps.resendConfig, sendEmail: deps.sendEmail },
        {
          eventType: params.eventType,
          bookingId: row.id,
          customerName,
          summary,
          recipient: admin,
          language: params.language,
          siteBaseUrl: deps.siteBaseUrl,
          dashboardPath: params.dashboardPath,
          triggeringRowId: params.triggeringRowId,
        },
      )
      outcomes.push({ recipientEmail: admin.email, ...outcome })
    } catch (err) {
      outcomes.push({
        recipientEmail: admin.email,
        status: 'skipped_error',
        errorMessage: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return outcomes
}
