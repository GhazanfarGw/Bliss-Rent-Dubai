/**
 * Single source of truth for Bliss Rent's direct-contact links.
 *
 * Phase 11 originally added these for the homepage navigator's Contact
 * panel; Task 2 (2026-09-11 scoped update) makes this the one place the
 * real WhatsApp number lives, replacing the placeholder that was
 * previously duplicated in both this file and NavBar.tsx's footer icon.
 * Every WhatsApp link in the app (footer icon, homepage Contact panel,
 * Contact Us page, public vehicle/category cards) must import
 * `WHATSAPP_URL` (or `whatsappUrlForVehicle`) from here — never hardcode
 * `wa.me/...` anywhere else — so the number can be changed in one place
 * later (e.g. once the real Meta WhatsApp Cloud API integration exists).
 *
 * No Meta API, no webhook, no provider integration: this is exactly the
 * standard wa.me/ direct-chat URL scheme, same as it always was.
 */
export const WHATSAPP_PHONE_INTL = '971547820057'
/** Human-readable form, for display only — never used to build the href (WHATSAPP_URL already has the correct wa.me-safe digits). */
export const WHATSAPP_PHONE_DISPLAY = '+971 54 782 0057'
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE_INTL}`

/**
 * A WhatsApp link pre-filled with a short, specific message about one
 * vehicle/category card — same number, same wa.me scheme, just with a
 * `?text=` query param (still a plain direct-chat URL, no API call).
 * Falls back to the plain `WHATSAPP_URL` if no vehicle text is given.
 */
export function whatsappUrlForVehicle(vehicleLabel: string): string {
  const text = `Hi Bliss Rent, I'm interested in the ${vehicleLabel}.`
  return `${WHATSAPP_URL}?text=${encodeURIComponent(text)}`
}

export const SUPPORT_EMAIL = 'support@bliss.rent'
export const SUPPORT_EMAIL_HREF = `mailto:${SUPPORT_EMAIL}`

export const OFFICE_ADDRESS = 'Apt 121B, Block B, Sajaya 7 Building, Manama Street, Nad Al Sheba 3, Dubai, UAE'
// Verified live in Google Maps (searching "Sajaya 7 Building, Manama
// Street, Nad Al Sheba 3, Dubai" resolves to a real listed place, "Sajaya
// 7" — a corporate office at "Al Manama St, Nad Al Sheba 3, Dubai",
// exactly matching this address) — coordinates: 25.163296, 55.382061.
// The FULL address (with apartment/block) is what's shown to customers;
// the map/directions links use these coordinates instead of the full
// address string, because geocoding the full string (with the
// apartment/block prefix) does NOT resolve to this building — it falls
// back to an unrelated result several kilometers away in Al Quoz. Pinning
// to the verified coordinates keeps the map accurate regardless of how
// Google's text geocoder handles the address string.
export const OFFICE_COORDS = '25.163296,55.382061'
export const OFFICE_MAPS_URL = `https://www.google.com/maps/dir/?api=1&destination=${OFFICE_COORDS}`
// Keyless Google Maps embed (maps.google.com/maps?...&output=embed) — no
// API key, no billing account, just a plain iframe centered on the
// verified coordinates above.
export const OFFICE_MAPS_EMBED_URL = `https://maps.google.com/maps?q=${OFFICE_COORDS}&z=16&output=embed`
