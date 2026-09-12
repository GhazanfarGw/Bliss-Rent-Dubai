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
