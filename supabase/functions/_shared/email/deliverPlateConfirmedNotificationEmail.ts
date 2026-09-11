// Phase 14 — delivers the `plate_confirmed` customer email for ONE booking,
// right after admin_confirm_booking_vehicle() has run.
//
// Deliberately a sibling of deliverExtensionNotifications.ts, not a change
// to it: that file is keyed off an extensionId and reads
// booking_extensions to discover which booking(s) to notify —
// plate_confirmed has no extension row at all, so this reads
// booking_notifications directly for a single, already-known bookingId
// (the caller has it in hand from admin_confirm_booking_vehicle()'s own
// return value). Every other building block — bookingEmailData.ts,
// recipient.ts, sendExtensionNotificationEmailIdempotently — is reused
// completely unchanged, so this introduces zero new email-sending
// machinery, only a new entry point into the existing one.
//
// ISOLATION: exactly like the extension pipeline, a problem resolving one
// notification row never throws past this function — it comes back as a
// 'skipped_no_recipient' outcome instead, so a missing customer email can
// never turn an already-successful plate confirmation into a thrown error
// for the admin who triggered it.

import { fetchBookingNotifications, type BookingNotificationsSource } from './extensionNotificationData.ts'
import { fetchBookingEmailRow, buildBookingSummaryFromRow, type BookingEmailDataSource } from './bookingEmailData.ts'
import { resolveCustomerRecipient } from './recipient.ts'
import { sendExtensionNotificationEmailIdempotently, type ExtensionSendOutcome } from './sendExtensionNotificationEmail.ts'
import type { EmailLogStore, SendCustomerEmailFn } from './sendCustomerBookingEmail.ts'
import type { ResendConfig } from './resendProvider.ts'
import type { EmailLanguage } from './strings.ts'

export interface DeliverPlateConfirmedNotificationDataSource extends BookingEmailDataSource, BookingNotificationsSource {}

export interface DeliverPlateConfirmedNotificationDeps {
  dataSource: DeliverPlateConfirmedNotificationDataSource
  emailLog: EmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendCustomerEmailFn
}

export type DeliveredPlateConfirmedOutcome = {
  notificationId: string
  bookingId: string
} & (ExtensionSendOutcome | { status: 'skipped_no_recipient'; errorMessage: string })

/**
 * Only the most recent plate_confirmed row for this booking is delivered —
 * a booking can only have one CURRENT confirmed plate at a time (a NEW
 * plate renames the Reserved copy in place; an EXISTING plate repoints
 * vehicle_id), so any earlier plate_confirmed row for the same booking
 * (e.g. from a since-superseded confirmation) is stale and must not be
 * re-sent. email_log's idempotency key is scoped to the notification row's
 * own id, so this also naturally prevents ever re-sending the same
 * already-delivered row twice.
 */
export async function deliverPlateConfirmedNotificationEmail(
  deps: DeliverPlateConfirmedNotificationDeps,
  bookingId: string,
  language: EmailLanguage,
): Promise<DeliveredPlateConfirmedOutcome[]> {
  const notifications = (await fetchBookingNotifications(deps.dataSource, [bookingId])).filter(
    (n) => n.notification_type === 'plate_confirmed',
  )
  if (notifications.length === 0) return []

  const mostRecent = notifications[0]

  try {
    const row = await fetchBookingEmailRow(deps.dataSource, mostRecent.booking_id)
    const recipient = resolveCustomerRecipient(row.customers)
    const summary = buildBookingSummaryFromRow(row)

    const outcome = await sendExtensionNotificationEmailIdempotently(
      { emailLog: deps.emailLog, resendConfig: deps.resendConfig, sendEmail: deps.sendEmail },
      {
        notificationId: mostRecent.id,
        notificationType: 'plate_confirmed',
        bookingId: mostRecent.booking_id,
        bookingReference: summary.reference,
        payload: mostRecent.payload,
        recipient,
        summary,
        language,
        siteBaseUrl: deps.siteBaseUrl,
      },
    )

    return [{ notificationId: mostRecent.id, bookingId: mostRecent.booking_id, ...outcome }]
  } catch (err) {
    return [
      {
        notificationId: mostRecent.id,
        bookingId: mostRecent.booking_id,
        status: 'skipped_no_recipient',
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    ]
  }
}
