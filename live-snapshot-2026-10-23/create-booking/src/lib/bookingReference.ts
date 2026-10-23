export function formatBookingReference(bookingId: string): string {
  return 'BLS-' + bookingId.replace(/-/g, '').slice(0, 8).toUpperCase()
}
