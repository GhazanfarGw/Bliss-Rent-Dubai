/**
 * Client-side mirror of the booking reference formula used server-side in
 * create_booking() and get_booking_by_reference() (Phase 2/6) — a
 * booking's reference is NEVER stored, only derived on demand from its id:
 *   'BLS-' || upper(left(replace(id::text, '-', ''), 8))
 * Used here only for display (e.g. the Phase 7 Extensions screens showing
 * "which booking"); never sent to the server or used to look anything up
 * — get_booking_by_reference remains the one real lookup path.
 */
export function formatBookingReference(bookingId: string): string {
  return 'BLS-' + bookingId.replace(/-/g, '').slice(0, 8).toUpperCase()
}
