// Phase 9D — best-effort customer-email trigger, shared by
// create-booking/index.ts and confirm-payment/index.ts.
//
// This function NEVER throws. It is called after handleCreateBooking /
// handleConfirmPayment has already succeeded and the booking/payment
// business logic in those functions' logic.ts has already run and
// returned its result — this file adds nothing to that decision, it only
// fires an email side-effect afterwards. Every failure mode (booking row
// vanished, no customer email on file, Resend down) is caught here and
// only logged, so an email problem can never turn a successful booking or
// payment response into an error, and never delays it by a retry.
import { fetchBookingEmailRow, buildBookingSummaryFromRow, type BookingEmailDataSource } from './bookingEmailData.ts'
import { resolveCustomerRecipient } from './recipient.ts'
import { sendCustomerBookingEmailIdempotently, type EmailLogStore, type SendCustomerEmailFn } from './sendCustomerBookingEmail.ts'
import type { CustomerBookingEventType } from './customerEmailContent.ts'
import type { ResendConfig } from './resendProvider.ts'
import type { EmailLanguage } from './strings.ts'

export interface TriggerCustomerBookingEmailParams {
  dataSource: BookingEmailDataSource
  emailLog: EmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  bookingId: string
  eventType: CustomerBookingEventType
  language: EmailLanguage
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendCustomerEmailFn
}

export async function triggerCustomerBookingEmail(params: TriggerCustomerBookingEmailParams): Promise<void> {
  try {
    const row = await fetchBookingEmailRow(params.dataSource, params.bookingId)
    const recipient = resolveCustomerRecipient(row.customers)
    const summary = buildBookingSummaryFromRow(row)

    await sendCustomerBookingEmailIdempotently(
      { emailLog: params.emailLog, resendConfig: params.resendConfig, sendEmail: params.sendEmail },
      {
        eventType: params.eventType,
        bookingId: row.id,
        bookingReference: summary.reference,
        recipient,
        summary,
        language: params.language,
        siteBaseUrl: params.siteBaseUrl,
      },
    )
  } catch (err) {
    // Deliberately swallowed — see the file header. Logged so a missing
    // customer email or a Resend outage is still visible in function logs.
    console.error(`triggerCustomerBookingEmail failed for booking ${params.bookingId} (${params.eventType})`, err)
  }
}
