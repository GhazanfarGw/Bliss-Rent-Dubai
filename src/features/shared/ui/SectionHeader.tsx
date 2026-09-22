import type { ReactNode } from 'react'
import { Eyebrow } from './Eyebrow'

interface SectionHeaderProps {
  title: string
  /** Small line-and-label heading shown above the title (customer-facing sections only). */
  eyebrow?: string
  description?: string
  action?: ReactNode
  /** Heading level — 'h1' for a page's own title (the default, matching
   *  every existing admin page), 'h2' when nested under a page that
   *  already renders its own h1 (e.g. a section within a longer
   *  customer-facing page), 'h3' for a sub-section nested under its own
   *  h2 (e.g. one of several independent sliders within a page section). */
  as?: 'h1' | 'h2' | 'h3'
  /** Opt-in only — pass 'marketing' from customer-facing call sites (Car
   *  Types, FAQ, Legal, Featured Vehicles, Vehicle Categories, Documents
   *  Required) to pick up the sitewide serif heading treatment
   *  (--font-hero-serif, see index.css) and the same normalized
   *  text-2xl/sm:text-3xl/md:text-4xl size (app-sized on a phone) every
   *  other major customer-facing heading uses. Every admin page uses this same component without
   *  this prop and is deliberately unaffected — admin section labels
   *  stay Cairo/sans at their existing size. */
  emphasis?: 'marketing'
}

/**
 * Generalizes the pre-Phase-8 `AdminPageHeader` (title/description/
 * action row) so customer-facing pages can use the identical pattern —
 * `AdminPageHeader` now aliases straight through with zero visual
 * change for every existing admin page.
 */
export function SectionHeader({ title, eyebrow, description, action, as = 'h1', emphasis }: SectionHeaderProps) {
  const Heading = as
  const headingClass =
    emphasis === 'marketing'
      ? 'font-hero-serif text-2xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-3xl md:text-4xl'
      : 'text-2xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-3xl lg:text-[3.0rem]'
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <Heading className={headingClass}>
          <span className="bg-gradient-to-r from-brand-navy via-brand-navy-light to-brand-gold-dark bg-clip-text text-transparent">
            {title}
          </span>
        </Heading>
        {description && <p className="mt-2 text-sm leading-6 text-text-muted sm:text-base">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
