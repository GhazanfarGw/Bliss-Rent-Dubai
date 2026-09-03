// Phase 9B — shared brand tokens for the email design system.
//
// [Brand system update — see claude/phase-9-email-brand-update-*.md]
// These are the OFFICIAL Bliss Rent Cars brand colors, given verbatim:
//
//   Primary Luxury Berry          #5C0931
//   Deep Space Blue (supporting)  #0B132B
//   Muted Champagne Gold (accent) #D4AF37
//   Sleek Platinum Gray           #F4F5F7
//   Crisp Clean White             #FFFFFF
//   Success Green (operational)   #10B981
//
// They are applied SEMANTICALLY, not as a 1:1 old-color swap:
//   - Luxury Berry    -> primary brand/action color (CTA buttons)
//   - Deep Space Blue -> supporting/dark structural tone (header/chrome)
//     and, reused as a foreground color, heading/emphasized text
//   - Champagne Gold  -> premium accent/highlight (attention banners,
//     admin "needs attention" priority)
//   - Platinum Gray   -> subtle backgrounds/borders
//   - White           -> clean surfaces/backgrounds
//   - Success Green   -> genuine success/positive operational states only
//
// A handful of values below are DERIVED, NOT official brand colors, and
// exist only because the official color fails WCAG AA as a foreground
// text color, or would be visually invisible as a border. Each is called
// out at its definition. No other colors were invented.
//
// This file previously mirrored the app's pre-redesign `@theme` tokens
// in src/index.css (--color-brand-navy / --color-brand-gold). The
// concurrent Phase 8 frontend redesign has since changed those tokens
// independently (src/index.css is off-limits to this email-only brand
// update — see the hard boundaries in the brand-update completion
// report), so this file no longer mirrors src/index.css; it is now the
// authoritative source for the six official brand colors above, applied
// to the transactional email system only.
//
// Contact details are the SAME bracketed placeholders that already exist
// in src/i18n/locales/en.ts (`pages.contact.methods`) — copied, not
// invented. Per the confirmed Phase 9A business decision, real values
// are supplied before production launch; until then every email that
// renders these must keep them visually marked as placeholders (see
// `renderFooter` in components.ts), never presented as real contact
// info to a customer.

export const BRAND_COLORS = {
  /** Official — Primary Luxury Berry: primary brand/action color (CTA buttons, primary emphasis). */
  primary: '#5C0931',

  /**
   * Official — Deep Space Blue: supporting/dark structural tone. Used as
   * a background for structural chrome (the email header bar), and
   * reused as a foreground color for headings/emphasized value text —
   * both are the same official hex, referenced under two names for
   * clarity at each call site.
   */
  structural: '#0B132B',
  text: '#0B132B',

  /**
   * Official — Muted Champagne Gold: premium accent/highlight (the
   * "needs attention"/warning tone, and small highlighted annotations).
   *
   * DERIVED, not an official color: pure #D4AF37 is only ~2.1:1 contrast
   * against white — well under the 4.5:1 WCAG AA minimum for text — so
   * `accentText` is a darkened shade of the same hue (~4.56:1 on white),
   * used only where Champagne Gold must render as foreground text.
   * `accentBg` is a light tint of the same hue used only as a background
   * wash, following the same base-color + light-"Bg"-tint pattern this
   * file already used for success/danger below.
   */
  accent: '#D4AF37',
  accentText: '#8D731E',
  accentBg: '#FCF9EF',

  /** Official — Sleek Platinum Gray: subtle backgrounds (page background, subtle info panels). */
  subtleBg: '#F4F5F7',

  /**
   * DERIVED, not an official color: pure Platinum Gray (#F4F5F7) is only
   * ~1.09:1 contrast against white — essentially invisible as a 1px
   * card/table border. `border` is a slightly deeper shade in the same
   * platinum-gray family, kept just visible enough to still delineate a
   * card edge (booking summary card, footer divider).
   */
  border: '#D9DCE1',

  /** Official — Crisp Clean White: clean surfaces/backgrounds (email card background, header text). */
  surface: '#FFFFFF',

  /**
   * DERIVED, not an official color: no muted body-copy tone was
   * specified in the official palette. `textMuted` is a muted slate in
   * the Deep Space Blue family (~6.15:1 contrast on white), used for
   * labels, support copy, and footer text where full heading-strength
   * contrast isn't wanted.
   */
  textMuted: '#5A6270',

  /** Official — Success Green: genuine success/positive operational states only. */
  success: '#10B981',

  /**
   * DERIVED, not an official color: pure Success Green (#10B981) is only
   * ~2.54:1 contrast against white — under the WCAG AA minimum for text
   * — so `successText` is a darkened shade of the same hue (~4.82:1 on
   * white), used only where Success Green must render as foreground
   * text. `successBg` is a light tint of the same hue used only as a
   * background wash.
   */
  successText: '#0B825A',
  successBg: '#ECF9F5',

  /**
   * Danger/urgent tones are NOT among the six official Bliss Rent Cars
   * brand colors, and no official error/danger color was given in this
   * update. These values predate the old navy/gold branding being
   * replaced here and are left unchanged.
   */
  danger: '#a33636',
  dangerBg: '#f7e9e9',
} as const

/** Confirmed in Phase 9A: bliss.rent is the real sending domain. */
export const SENDING_DOMAIN = 'bliss.rent'

export const BRAND_NAME = 'Bliss Rent'

/**
 * Confirmed in Phase 9A ("use placeholders for now"): these are copied
 * character-for-character from src/i18n/locales/en.ts, not invented.
 * Replace with real values before production launch — see
 * PHASE9_BUSINESS_DECISIONS item 2.
 */
export const PLACEHOLDER_CONTACT = {
  whatsapp: '[+971 5X XXX XXXX]',
  email: '[support@bliss.rent]',
  address: '[Office address, Dubai, UAE]',
  hours: '[e.g. 24/7, or specific hours]',
} as const

export const CURRENCY = 'AED'
