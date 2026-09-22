import { DirhamSymbol } from 'dirham/react'

/**
 * Renders the UAE Dirham currency mark next to a price. Uses the new,
 * Central-Bank-issued Dirham symbol (Unicode U+20C3, standardized in
 * Unicode 18.0 — Sept 2026) via the `dirham` package's inline-SVG
 * component: no web font to load, renders correctly today regardless of
 * OS/browser support for the codepoint, and needs no code change once
 * native rendering lands.
 *
 * Falls back to the plain currency code for anything that isn't AED —
 * defensive only, since every price on this site is AED (Dubai-only fleet).
 *
 * `size="1em"` scales the symbol with the surrounding text's font-size, and
 * `color="currentColor"` (the component default) inherits the text color,
 * so it drops into any of the existing price lines unchanged.
 */
export function CurrencySymbol({ currency }: { currency: string }) {
  if (currency !== 'AED') return <>{currency}</>
  return <DirhamSymbol size="1em" aria-label="AED" />
}
