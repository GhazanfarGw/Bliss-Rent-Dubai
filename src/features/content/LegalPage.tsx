import { useTranslation } from 'react-i18next'
import { SectionHeader } from '@/features/shared/ui/SectionHeader'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'

interface LegalSection {
  heading: string
  paragraphs?: string[]
  list?: string[]
}

interface LegalPageProps {
  title: string
  updated: string
  draftNotice: string
  intro?: string
  sections: LegalSection[]
}

/**
 * Shared renderer for the three draft legal pages (Privacy Policy, Cookie
 * Policy, Booking Terms & Conditions). All three are standard,
 * plain-language starting points — not legal advice — and carry bracketed
 * placeholders (e.g. "[__]") for business-specific numbers the owner still
 * needs to supply. The amber "DRAFT" banner is intentionally the same
 * component on all three so none of them can quietly lose it during a
 * future edit.
 */
function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function LegalPage({ title, updated, draftNotice, intro, sections }: LegalPageProps) {
  const { t } = useTranslation()
  useDocumentTitle(title)
  useMetaDescription(intro)
  // A jump-to-section list only earns its place on the longer documents
  // (Privacy Policy, Booking Terms) — the shortest one (Cookie Policy)
  // has too few sections for it to help, so it's skipped there rather
  // than adding clutter to a document that's already easy to scan.
  const showToc = sections.length > 4
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <SectionHeader title={title} description={updated} emphasis="marketing" />

      <div className="mt-6 rounded-xl border border-warning/30 bg-warning-bg px-5 py-4 text-sm text-warning">
        <p className="font-semibold">{t('pages.draftBannerTitle')}</p>
        <p className="mt-1">{draftNotice}</p>
      </div>

      {intro && <p className="mt-6 text-sm leading-relaxed text-brand-navy/80">{intro}</p>}

      {showToc && (
        <nav aria-label={t('pages.legalTableOfContents')} className="mt-6 border border-brand-navy/10 bg-surface-warm p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('pages.legalTableOfContents')}</p>
          <ol className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {sections.map((section) => (
              <li key={section.heading}>
                <a href={`#${slugify(section.heading)}`} className="text-sm text-brand-gold-dark underline-offset-2 hover:underline">
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.heading} id={slugify(section.heading)} className="scroll-mt-20">
            <h2 className="text-base font-semibold text-brand-navy">{section.heading}</h2>
            {section.paragraphs?.map((p, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-brand-navy/80">
                {p}
              </p>
            ))}
            {section.list && (
              <ul className="mt-2 list-disc space-y-1.5 ps-5 text-sm leading-relaxed text-brand-navy/80">
                {section.list.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
