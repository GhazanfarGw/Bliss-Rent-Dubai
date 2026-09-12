// Phase 9F — fans an admin operational email out to every currently
// active admin for one booking + event. Mirrors the isolation guarantee
// 9E's deliverExtensionNotifications.ts already established for its own
// multi-recipient case (one notification row per booking there; one
// admin recipient per booking/event here): a problem with ONE admin's
// send (a stale/unreachable Auth account, a Resend hiccup for that one
// address) must never block the email going out to any OTHER active
// admin for the same event.
//
// Reuses 9D's fetchBookingEmailRow/buildBookingSummaryFromRow UNCHANGED
// — the booking data an admin email's summary card needs is exactly the
// same data a customer email's summary card needs, read the same
// read-only way.

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
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendAdminEmailFn
}

export interface DeliverAdminOperationalEmailsParams {
  bookingId: string
  eventType: AdminOperationalEventType
  language: EmailLanguage
  dashboardPath: string
  /** See sendAdminOperationalEmail.ts — only meaningful for admin_extension_requested today. */
  triggeringRowId?: string
}

export type DeliveredAdminEmailOutcome =
  | ({ recipientEmail: string } & AdminSendOutcome)
  | { recipientEmail: string; status: 'skipped_error'; errorMessage: string }

export async function deliverAdminOperationalEmails(
  deps: DeliverAdminOperationalEmailsDeps,
  params: DeliverAdminOperationalEmailsParams,
): Promise<DeliveredAdminEmailOutcome[]> {
  // Not caught here on purpose — a booking that genuinely doesn't exist
  // is a real error the caller (triggerAdminOperationalEmail.ts) should
  // see and log, same as 9E's deliverExtensionNotifications.ts lets
  // ExtensionNotFoundError propagate to its own caller.
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
      // Isolation guarantee: one admin's unexpected failure (e.g. the
      // email_log insert itself throwing) never stops the loop — every
      // other active admin still gets their copy.
      outcomes.push({
        recipientEmail: admin.email,
        status: 'skipped_error',
        errorMessage: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return outcomes
}
