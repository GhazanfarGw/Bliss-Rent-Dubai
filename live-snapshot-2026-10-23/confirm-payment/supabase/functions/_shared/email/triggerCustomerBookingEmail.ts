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
    console.error(`triggerCustomerBookingEmail failed for booking ${params.bookingId} (${params.eventType})`, err)
  }
}
