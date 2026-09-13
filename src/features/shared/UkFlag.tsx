// A plain inline SVG of the UK flag (Union Jack, public domain), used
// next to the "switch to English" option in the language switcher —
// the common convention on bilingual Gulf-region sites for representing
// the English option, alongside the real UAE flag (see UaeFlag.tsx) for
// the Arabic option. Built from stroked diagonal/cross lines rather than
// precise official construction-sheet polygons — a deliberate small-icon
// simplification (common in compact flag-icon sets), not an attempt at
// an exact geometric reproduction.
export function UkFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#00247d" />
      <line x1="0" y1="0" x2="30" y2="20" stroke="#fff" strokeWidth="4" />
      <line x1="30" y1="0" x2="0" y2="20" stroke="#fff" strokeWidth="4" />
      <line x1="0" y1="0" x2="30" y2="20" stroke="#cf142b" strokeWidth="1.3" />
      <line x1="30" y1="0" x2="0" y2="20" stroke="#cf142b" strokeWidth="1.3" />
      <line x1="15" y1="0" x2="15" y2="20" stroke="#fff" strokeWidth="6.6" />
      <line x1="0" y1="10" x2="30" y2="10" stroke="#fff" strokeWidth="4.4" />
      <line x1="15" y1="0" x2="15" y2="20" stroke="#cf142b" strokeWidth="4" />
      <line x1="0" y1="10" x2="30" y2="10" stroke="#cf142b" strokeWidth="2.6" />
    </svg>
  )
}
