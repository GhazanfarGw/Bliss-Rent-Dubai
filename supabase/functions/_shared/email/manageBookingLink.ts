// Confirmed Phase 9A business decision (item 7): the Manage Booking CTA
// in emails uses a pre-filled `?ref=BLS-XXXXXXXX` link, not a plain link
// to the empty lookup form. The reference is already shown to the
// customer on the confirmation page today — it is not a secret, so
// putting it in a URL query string is consistent with existing exposure.
//
// NOTE (flagged for a decision, see the 9B completion report): the route
// this points at, /manage-booking (src/App.tsx), does not currently read
// a `ref` query parameter — ManageBookingPage.tsx's query field always
// starts empty. This helper builds the correct target URL now so the
// template architecture is ready, but the page itself needs a small,
// separate change (read `?ref=` and pre-fill the field) before the link
// actually pre-fills anything for a real customer. That page change is
// outside 9B's scope (template architecture only) and is not made here.

export function buildManageBookingUrl(siteBaseUrl: string, bookingReference: string): string {
  const base = siteBaseUrl.replace(/\/+$/, '')
  return `${base}/manage-booking?ref=${encodeURIComponent(bookingReference)}`
}
