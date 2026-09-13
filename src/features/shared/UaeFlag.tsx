// A plain inline SVG of the UAE national flag (public domain, correct
// proportions/colors) — used anywhere the app needs a real "this is
// UAE-related" indicator (the header's Cities dropdown, the language
// switcher's Arabic option) instead of the 🇦🇪 emoji character. Some
// browser/OS/font combinations render flag-sequence emoji as bare
// two-letter text ("AE") rather than an actual flag glyph (confirmed on
// one Windows Chrome setup while building this); an SVG renders
// identically everywhere. Never used to represent a specific emirate —
// this app is UAE-wide, and individual emirates don't have widely
// recognized separate flags this app could show without inventing one.
export function UaeFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 14" className={className} aria-hidden="true">
      <rect width="20" height="14" fill="#00732f" />
      <rect y="4.667" width="20" height="4.667" fill="#fff" />
      <rect y="9.333" width="20" height="4.667" fill="#000" />
      <rect width="5" height="14" fill="#ff0000" />
    </svg>
  )
}
