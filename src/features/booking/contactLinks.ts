/**
 * Phase 11 correction — the homepage navigator's Contact panel needs real
 * `href`s (a `wa.me` link, a `mailto:` link), not just display copy. These
 * constants reuse the exact contact details already configured elsewhere
 * in the app rather than inventing new ones:
 *  - `WHATSAPP_URL` is the same WhatsApp number already linked from the
 *    site footer (see NavBar.tsx's social icon row).
 *  - `SUPPORT_EMAIL` is the same address already shown as the support
 *    email on the Contact Us page (`pages.contact.methods.email.value`,
 *    en.ts/ar.ts), with the `[...]` placeholder brackets — a copy-editing
 *    marker, not part of the address — stripped so it works as a link.
 */
export const WHATSAPP_URL = 'https://wa.me/971500000000'
export const SUPPORT_EMAIL = 'support@bliss.rent'
export const SUPPORT_EMAIL_HREF = `mailto:${SUPPORT_EMAIL}`
