// Phase 9E — read-only access to booking_extensions / booking_notifications
// for the extension/reassignment email flow. Every query here is a plain
// SELECT: this file never inserts, updates, or deletes a row in either
// table, and never touches request_booking_extension(),
// confirm_booking_extension_payment(), reject_extension_request(), or
// resolve_extension_conflict() — it only reads what those functions
// already recorded, exactly as the 9E instruction requires ("use the
// existing booking_notifications rows as the source").
//
// Design note (flagged in the 9E completion report): rather than trying
// to replicate in TypeScript exactly which notification_type each SQL
// function conditionally inserts for which booking (source='customer'
// checks, penalty branches, etc.), this reads the extension's CURRENT
// booking_id and conflict_booking_id (both plain columns on
// booking_extensions, set by the very SQL this phase must not modify) and
// fetches whatever booking_notifications rows exist for either booking.
// If a given call produced no notification for a booking, the query
// simply returns nothing for it — no business logic is duplicated here,
// and email_log's idempotency key (keyed on the notification row's own
// id) makes re-attempting delivery of an already-sent row a safe no-op.

export interface ExtensionBookingIds {
  bookingId: string
  conflictBookingId: string | null
}

export class ExtensionNotFoundError extends Error {}

export interface ExtensionRecordSource {
  from(table: 'booking_extensions'): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{
          data: { id: string; booking_id: string; conflict_booking_id: string | null } | null
          error: { message: string } | null
        }>
      }
    }
  }
}

export async function fetchExtensionBookingIds(source: ExtensionRecordSource, extensionId: string): Promise<ExtensionBookingIds> {
  const { data, error } = await source
    .from('booking_extensions')
    .select('id, booking_id, conflict_booking_id')
    .eq('id', extensionId)
    .maybeSingle()
  if (error) throw new ExtensionNotFoundError(`fetchExtensionBookingIds: ${error.message}`)
  if (!data) throw new ExtensionNotFoundError(`fetchExtensionBookingIds: no booking_extensions row for id ${extensionId}`)
  return { bookingId: data.booking_id, conflictBookingId: data.conflict_booking_id }
}

export interface BookingNotificationRow {
  id: string
  booking_id: string
  notification_type: string
  payload: Record<string, unknown>
  created_at: string
}

export interface BookingNotificationsSource {
  from(table: 'booking_notifications'): {
    select(columns: string): {
      in(column: string, values: string[]): {
        order(column: string, options: { ascending: boolean }): {
          limit(count: number): Promise<{ data: BookingNotificationRow[] | null; error: { message: string } | null }>
        }
      }
    }
  }
}

/** Bounded to the most recent 20 rows across the given booking ids — a single extension/reassignment action produces at most 2 rows, so this comfortably covers even a booking with a long extension history without an unbounded scan. */
const NOTIFICATION_FETCH_LIMIT = 20

export async function fetchBookingNotifications(source: BookingNotificationsSource, bookingIds: string[]): Promise<BookingNotificationRow[]> {
  const uniqueIds = Array.from(new Set(bookingIds.filter((id): id is string => Boolean(id))))
  if (uniqueIds.length === 0) return []

  const { data, error } = await source
    .from('booking_notifications')
    .select('id, booking_id, notification_type, payload, created_at')
    .in('booking_id', uniqueIds)
    .order('created_at', { ascending: false })
    .limit(NOTIFICATION_FETCH_LIMIT)
  if (error) throw new Error(`fetchBookingNotifications: ${error.message}`)
  return data ?? []
}
