// Phase 9F — best-effort admin-email trigger, the admin-side equivalent
// of 9D's triggerCustomerBookingEmail.ts. Used the same way: called
// in-process, right after the underlying business action has already
// succeeded, from create-booking/index.ts, confirm-payment/index.ts,
// submit-extension-request/index.ts, and (via a small dedicated Edge
// Function, since that call site has no in-process hook — see
// notify-admin-booking-cancelled/logic.ts) adminBookingsApi.ts's
// cancellation flow.
//
// NEVER throws. Every failure mode — the booking row vanished, no active
// admin resolved to an email, a database error inside
// deliverAdminOperationalEmails — is caught here and only logged, so an
// admin-notification problem can never turn an already-successful
// booking/payment/extension-request response into an error, and never
// delays it by a retry. Mirrors triggerCustomerBookingEmail.ts's own
// guarantee exactly.

import { deliverAdminOperationalEmails, type DeliverAdminOperationalEmailsDataSource } from './deliverAdminOperationalEmails.ts'
import type { AdminEmailLogStore, SendAdminEmailFn } from './sendAdminOperationalEmail.ts'
import type { GetAdminEmailFn } from './adminRecipients.ts'
import type { AdminOperationalEventType } from './adminOperationalEmailContent.ts'
import type { ResendConfig } from './resendProvider.ts'
import type { EmailLanguage } from './strings.ts'

export interface TriggerAdminOperationalEmailParams {
  dataSource: DeliverAdminOperationalEmailsDataSource
  getAdminEmail: GetAdminEmailFn
  emailLog: AdminEmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  bookingId: string
  eventType: AdminOperationalEventType
  language: EmailLanguage
  dashboardPath: string
  /** See sendAdminOperationalEmail.ts — only meaningful for admin_extension_requested today. */
  triggeringRowId?: string
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendAdminEmailFn
}

export async function triggerAdminOperationalEmail(params: TriggerAdminOperationalEmailParams): Promise<void> {
  try {
    await deliverAdminOperationalEmails(
      {
        dataSource: params.dataSource,
        getAdminEmail: params.getAdminEmail,
        emailLog: params.emailLog,
        resendConfig: params.resendConfig,
        siteBaseUrl: params.siteBaseUrl,
        sendEmail: params.sendEmail,
      },
      {
        bookingId: params.bookingId,
        eventType: params.eventType,
        language: params.language,
        dashboardPath: params.dashboardPath,
        triggeringRowId: params.triggeringRowId,
      },
    )
  } catch (err) {
    // Deliberately swallowed — see the file header. Logged so a vanished
    // booking, zero resolvable admin recipients, or a Resend outage stays
    // visible in function logs rather than silently disappearing.
    console.error(`triggerAdminOperationalEmail failed for booking ${params.bookingId} (${params.eventType})`, err)
  }
}
