export function buildManageBookingUrl(siteBaseUrl: string, bookingReference: string): string {
  const base = siteBaseUrl.replace(/\/+$/, '')
  return `${base}/manage-booking?ref=${encodeURIComponent(bookingReference)}`
}
