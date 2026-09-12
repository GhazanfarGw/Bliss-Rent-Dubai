// Phase 9E — orchestrates delivering every booking_notifications row an
// extension/reassignment action produced, for one booking_extensions row.
// Ties together: extensionNotificationData.ts (read-only source),
// bookingEmailData.ts / recipient.ts (9D, reused unchanged for recipient
// resolution and the booking summary card), and
// sendExtensionNotificationEmail.ts (this phase's idempotent send).
//
// LANGUAGE: there is no stored per-customer language preference anywhere
// in this schema (checked before writing this — see the 9E completion
// report), and these deliveries are admin-triggered, not a live customer
// session with a known UI language the way create-booking/confirm-payment
// have via checkoutApi.ts. So every delivery defaults to English unless
// the caller explicitly passes 'ar' — the same convention
// send-customer-email/logic.ts already uses for its own admin-triggered
// sends. Wiring this to a real per-customer preference is future work,
// not invented here.
//
// ISOLATION: a problem with ONE notification row (no recipient email on
// file, a bad payload, a Resend failure) never blocks any OTHER row in
// the same batch — e.g. the customer whose future booking got reassigned
// having no email on file must not stop the extending customer's own
// approval email from going out, and vice versa.

import {
  fetchExtensionBookingIds,
  fetchBookingNotifications,
  type ExtensionRecordSource,
  type BookingNotificationsSource,
} from './extensionNotificationData.ts'
import { fetchBookingEmailRow, buildBookingSummaryFromRow, type BookingEmailDataSource } from './bookingEmailData.ts'
import { resolveCustomerRecipient } from './recipient.ts'
import { sendExtensionNotificationEmailIdempotently, type ExtensionSendOutcome } from './sendExtensionNotificationEmail.ts'
import { EXTENSION_NOTIFICATION_TYPES, type ExtensionNotificationType } from './extensionNotificationContent.ts'
import type { EmailLogStore, SendCustomerEmailFn } from './sendCustomerBookingEmail.ts'
import type { ResendConfig } from './resendProvider.ts'
import type { EmailLanguage } from './strings.ts'

export interface DeliverExtensionNotificationsDataSource extends BookingEmailDataSource, ExtensionRecordSource, BookingNotificationsSource {}

export interface DeliverExtensionNotificationsDeps {
  dataSource: DeliverExtensionNotificationsDataSource
  emailLog: EmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendCustomerEmailFn
}

export type DeliveredNotificationOutcome = {
  notificationId: string
  bookingId: string
  notificationType: string
} & (ExtensionSendOutcome | { status: 'skipped_no_recipient'; errorMessage: string })

export async function deliverExtensionNotificationEmails(
  deps: DeliverExtensionNotificationsDeps,
  extensionId: string,
  language: EmailLanguage,
): Promise<DeliveredNotificationOutcome[]> {
  const { bookingId, conflictBookingId } = await fetchExtensionBookingIds(deps.dataSource, extensionId)
  const bookingIds = [bookingId, conflictBookingId].filter((id): id is string => Boolean(id))
  const notifications = await fetchBookingNotifications(deps.dataSource, bookingIds)

  const outcomes: DeliveredNotificationOutcome[] = []

  for (const notification of notifications) {
    if (!EXTENSION_NOTIFICATION_TYPES.includes(notification.notification_type as ExtensionNotificationType)) {
      // Defensive: a future notification_type this module doesn't know
      // content for yet is silently skipped rather than guessed at.
      continue
    }

    try {
      const row = await fetchBookingEmailRow(deps.dataSource, notification.booking_id)
      const recipient = resolveCustomerRecipient(row.customers)
      const summary = buildBookingSummaryFromRow(row)

      const outcome = await sendExtensionNotificationEmailIdempotently(
        { emailLog: deps.emailLog, resendConfig: deps.resendConfig, sendEmail: deps.sendEmail },
        {
          notificationId: notification.id,
          notificationType: notification.notification_type as ExtensionNotificationType,
          bookingId: notification.booking_id,
          bookingReference: summary.reference,
          payload: notification.payload,
          recipient,
          summary,
          language,
          siteBaseUrl: deps.siteBaseUrl,
        },
      )

      outcomes.push({
        notificationId: notification.id,
        bookingId: notification.booking_id,
        notificationType: notification.notification_type,
        ...outcome,
      })
    } catch (err) {
      // Catches BookingEmailDataError / MissingRecipientError (the
      // expected cases — booking vanished, no email on file) AND any
      // other unexpected failure (a transient DB error, etc.) — every
      // case is isolated to this one row so it can never block delivery
      // of any other notification in the same batch. The caller (this
      // Edge Function's logic.ts, and the frontend's best-effort trigger
      // above that) is what decides whether a batch-level failure should
      // be logged further; this loop's job is only to keep going.
      outcomes.push({
        notificationId: notification.id,
        bookingId: notification.booking_id,
        notificationType: notification.notification_type,
        status: 'skipped_no_recipient',
        errorMessage: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return outcomes
}
