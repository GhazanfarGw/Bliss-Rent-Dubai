import type { ReactNode } from 'react'

/**
 * The small heading that sits above a section's big heading: a short gold
 * line, then the label in tiny tracked capitals. Every left-aligned section
 * on the homepage uses this one component (not a retyped <p>), so the
 * marker, size and spacing can't drift from section to section.
 */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={'flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.32em] text-brand-gold-dark' + (className ? ' ' + className : '')}>
      <span className="h-px w-8 bg-brand-champagne" aria-hidden="true" />
      {children}
    </p>
  )
}
