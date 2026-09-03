// Phase 9H — fans a Contact Us complaint notification out to every
// currently active admin. Mirrors 9F's deliverAdminOperationalEmails.ts
// isolation guarantee exactly (one admin's send problem never blocks
// delivery to any other active admin) but does not fetch a booking row —
// a complaint may have none. Reuses resolveAdminRecipients unchanged.

import { resolveAdminRecipients, type ActiveAdminsSource, type GetAdminEmailFn } from './adminRecipients.ts'
import {
  sendComplaintNotificationEmailIdempotently,
  type SendComplaintEmailFn,
  type ComplaintSendOutcome,
} from './sendComplaintNotificationEmail.ts'
import type { AdminEmailLogStore } from './sendAdminOperationalEmail.ts'
import type { ResendConfig } from './resendProvider.ts'
import type { EmailLanguage } from './strings.ts'

export interface DeliverComplaintNotificationDeps {
  adminsSource: ActiveAdminsSource
  getAdminEmail: GetAdminEmailFn
  emailLog: AdminEmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendComplaintEmailFn
}

export interface DeliverComplaintNotificationParams {
  complaintId: string
  reporterName: string
  reporterEmail: string
  subject: string
  description: string
  language: EmailLanguage
  dashboardPath: string
}

export type DeliveredComplaintEmailOutcome =
  | ({ recipientEmail: string } & ComplaintSendOutcome)
  | { recipientEmail: string; status: 'skipped_error'; errorMessage: string }

export async function deliverComplaintNotification(
  deps: DeliverComplaintNotificationDeps,
  params: DeliverComplaintNotificationParams,
): Promise<DeliveredComplaintEmailOutcome[]> {
  const admins = await resolveAdminRecipients(deps.adminsSource, deps.getAdminEmail)
  if (admins.length === 0) {
    return []
  }

  const outcomes: DeliveredComplaintEmailOutcome[] = []
  for (const admin of admins) {
    try {
      const outcome = await sendComplaintNotificationEmailIdempotently(
        { emailLog: deps.emailLog, resendConfig: deps.resendConfig, sendEmail: deps.sendEmail },
        {
          complaintId: params.complaintId,
          reporterName: params.reporterName,
          reporterEmail: params.reporterEmail,
          subject: params.subject,
          description: params.description,
          recipient: admin,
          language: params.language,
          siteBaseUrl: deps.siteBaseUrl,
          dashboardPath: params.dashboardPath,
        },
      )
      outcomes.push({ recipientEmail: admin.email, ...outcome })
    } catch (err) {
      // Isolation guarantee — see deliverAdminOperationalEmails.ts.
      outcomes.push({
        recipientEmail: admin.email,
        status: 'skipped_error',
        errorMessage: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return outcomes
}
