/**
 * Phase 11 correction — the homepage navigator's Manage Booking panel asks
 * for the Booking Reference AND the Last Name (unlike the single-field
 * Manage Booking page itself; see lookupApi.ts for that deliberate
 * trade-off, which is untouched by this file). There is no second backend
 * verification algorithm here: this still calls the same authoritative
 * `lookup_booking_for_customer()` RPC by reference, then this pure,
 * framework-free helper checks the last name against the `customer_name`
 * the RPC already returned — an extra client-side confirmation layer on
 * top of existing data, not a new source of truth.
 *
 * `customer_name` is stored as one free-text full name (see
 * types/domain.ts BookingLookupResult), not separate first/last fields, so
 * the match is intentionally a little lenient: it accepts the last word of
 * the stored name, or a multi-word surname suffix (e.g. "Al Maktoum"), so a
 * real customer typing their actual last name is not rejected on a
 * technicality.
 */
export function lastNameMatches(customerName: string, inputLastName: string): boolean {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const name = normalize(customerName)
  const input = normalize(inputLastName)
  if (!name || !input) return false
  if (name === input) return true
  if (name.endsWith(' ' + input)) return true
  return name.split(' ').includes(input)
}
