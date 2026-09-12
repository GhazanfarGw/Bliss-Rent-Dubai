const STORAGE_KEY = 'dxb-cookie-consent'

export type CookieConsent = 'accepted' | 'declined'

/**
 * The site's cookies (see Cookie Policy — src/i18n/locales/en.ts
 * `pages.cookiePolicy`) are essential-only today: language preference
 * (`dxb-language`) and the guest booking session (sessionStorage, see
 * checkoutStorage.ts). There is no analytics or ad tracking to actually
 * turn off, so "Decline" doesn't disable anything functional — it just
 * records the visitor's choice, honestly, for whenever a non-essential
 * cookie is ever added (the policy already documents that this page
 * would be updated first). Both choices simply dismiss the banner.
 */
export function readCookieConsent(): CookieConsent | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'accepted' || value === 'declined' ? value : null
  } catch {
    // localStorage can throw in some contexts (private browsing, disabled
    // storage) — treat as "no choice recorded yet" rather than crashing.
    return null
  }
}

export function storeCookieConsent(consent: CookieConsent): void {
  try {
    localStorage.setItem(STORAGE_KEY, consent)
  } catch {
    // best-effort only — the banner still dismisses for this visit even
    // if the choice can't be persisted.
  }
}
