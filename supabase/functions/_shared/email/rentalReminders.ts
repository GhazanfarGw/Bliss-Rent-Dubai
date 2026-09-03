// Phase 9G — pickup/return reminder emails.
//
// Reuses 9D's sendCustomerBookingEmailIdempotently/customerEmailContent
// pipeline COMPLETELY UNCHANGED (only additively widened —
// pickup_reminder/return_reminder are two more entries in
// customerEmailContent.ts's existing union) rather than building a
// parallel one: unlike Phase 9H's complaints, every reminder genuinely IS
// about one real booking, so there's no structural mismatch to work
// around here.
//
// REMINDER WINDOW (an assumption, not a recorded business decision — see
// this module's own migration, 20260914000000_phase9g_rental_reminders.sql,
// for the same note): exactly 1 day before start_date (pickup) or
// end_date (return), a single constant below. No advance/late window
// logic beyond that. Each booking gets each reminder AT MOST ONCE — the
// once-per-booking idempotency key (buildOncePerBookingKey, unchanged
// from 9D) guarantees that even if this function is invoked more than
// once on the same day (a retried cron run, a manual re-trigger).
//
// SCOPE: read-only against `bookings` — this module never writes to it,
// never changes a booking's status, and never touches pricing/
// availability. It only reads rows whose status/date already put them in
// the reminder window and sends an informational email about them.

import { buildBookingSummaryFromRow, type BookingEmailRow } from './bookingEmailData.ts'
import { resolveCustomerRecipient, MissingRecipientError } from './recipient.ts'
import { sendCustomerBookingEmailIdempotently, type EmailLogStore, type SendCustomerEmailFn } from './sendCustomerBookingEmail.ts'
import type { ResendConfig } from './resendProvider.ts'

/** Days before the relevant date to send each reminder. A single, easily-adjusted constant — not a business decision recorded anywhere, since none exists yet. */
export const REMINDER_WINDOW_DAYS = 1

export type ReminderEventType = 'pickup_reminder' | 'return_reminder'

/** The minimal slice of the supabase-js client surface this module needs for a bulk, date-filtered, read-only query — narrow on purpose, same convention as bookingEmailData.ts's BookingEmailDataSource. */
export interface RentalReminderDataSource {
  from(table: 'bookings'): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        eq(column2: string, value2: string): Promise<{ data: BookingEmailRow[] | null; error: { message: string } | null }>
      }
    }
  }
}

export class RentalReminderDataError extends Error {}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Exported purely so tests can assert the exact date the module computed, without re-implementing date math. */
export function addDaysIso(date: Date, days: number): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  copy.setUTCDate(copy.getUTCDate() + days)
  return isoDate(copy)
}

async function fetchDueBookings(
  dataSource: RentalReminderDataSource,
  status: 'confirmed' | 'active',
  dateColumn: 'start_date' | 'end_date',
  dueDate: string,
): Promise<BookingEmailRow[]> {
  const { data, error } = await dataSource
    .from('bookings')
    .select(
      'id, status, start_date, end_date, total_price, currency, customers(full_name, email), vehicles(make, model), pickup_location:locations!bookings_pickup_location_id_fkey(name), dropoff_location:locations!bookings_dropoff_location_id_fkey(name)',
    )
    .eq('status', status)
    .eq(dateColumn, dueDate)
  if (error) throw new RentalReminderDataError(`fetchDueBookings(${status}, ${dateColumn}): ${error.message}`)
  return data ?? []
}

export interface SendRentalRemindersDeps {
  dataSource: RentalReminderDataSource
  emailLog: EmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  /** Injectable for tests; defaults to real "now". */
  today?: Date
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendCustomerEmailFn
}

export type ReminderOutcome =
  | { bookingId: string; eventType: ReminderEventType; status: 'sent'; emailLogId: string; providerMessageId?: string }
  | { bookingId: string; eventType: ReminderEventType; status: 'skipped_duplicate' }
  | { bookingId: string; eventType: ReminderEventType; status: 'send_failed'; errorMessage: string }
  | { bookingId: string; eventType: ReminderEventType; status: 'skipped_error'; errorMessage: string }

async function sendOneReminder(
  deps: SendRentalRemindersDeps,
  row: BookingEmailRow,
  eventType: ReminderEventType,
): Promise<ReminderOutcome> {
  try {
    const recipient = resolveCustomerRecipient(row.customers)
    const summary = buildBookingSummaryFromRow(row)
    const outcome = await sendCustomerBookingEmailIdempotently(
      { emailLog: deps.emailLog, resendConfig: deps.resendConfig, sendEmail: deps.sendEmail },
      {
        eventType,
        bookingId: row.id,
        bookingReference: summary.reference,
        recipient,
        summary,
        language: 'en', // no stored per-customer language preference exists — same known limitation as every other Phase 9 phase's admin-side emails
        siteBaseUrl: deps.siteBaseUrl,
      },
    )
    return { bookingId: row.id, eventType, ...outcome }
  } catch (err) {
    // Isolation guarantee: one booking's missing customer email
    // (MissingRecipientError) or any other unexpected failure never
    // blocks a reminder from reaching every other booking in the same
    // batch — same pattern as deliverAdminOperationalEmails.ts.
    const errorMessage =
      err instanceof MissingRecipientError || err instanceof Error ? err.message : String(err)
    return { bookingId: row.id, eventType, status: 'skipped_error', errorMessage }
  }
}

/**
 * Runs one reminder pass: finds every booking whose pickup or return date
 * is exactly REMINDER_WINDOW_DAYS away and sends the matching reminder,
 * isolating every booking's outcome from every other booking's. Never
 * writes to `bookings`. Safe to invoke more than once for the same day —
 * the underlying idempotency key ensures a booking is never reminded
 * twice for the same event.
 */
export async function handleSendRentalReminders(deps: SendRentalRemindersDeps): Promise<ReminderOutcome[]> {
  const dueDate = addDaysIso(deps.today ?? new Date(), REMINDER_WINDOW_DAYS)

  const outcomes: ReminderOutcome[] = []

  const pickupRows = await fetchDueBookings(deps.dataSource, 'confirmed', 'start_date', dueDate)
  for (const row of pickupRows) {
    outcomes.push(await sendOneReminder(deps, row, 'pickup_reminder'))
  }

  const returnRows = await fetchDueBookings(deps.dataSource, 'active', 'end_date', dueDate)
  for (const row of returnRows) {
    outcomes.push(await sendOneReminder(deps, row, 'return_reminder'))
  }

  return outcomes
}
