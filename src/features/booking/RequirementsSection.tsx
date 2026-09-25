import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ArrowRight } from 'lucide-react'

interface RequirementItem {
  title: string
  body: string
}

interface DocumentsGroup {
  title: string
  items: string[]
}

/**
 * "Before you book" — redesign merges the old two stacked sections
 * (RequirementsSection's 3-card numbered grid, and the separate
 * DocumentsRequiredSection below it) into one 50/50 split: the real,
 * already-enforced rental requirements (18+ driver age matches the
 * checkout validation in DriverDetailsPage; airport pickup / city
 * drop-off matches the footer's coverage note) as a plain numbered list
 * on the left, and the resident/visitor document checklists — the same
 * real, publicly documented UAE requirements DocumentsRequiredSection
 * used, just recolored for the dark card — as one "floating" dark card
 * on the right. Nothing invented on either side.
 */
export function RequirementsSection() {
  const { t } = useTranslation()
  const items = t('home.requirements.items', { returnObjects: true }) as RequirementItem[]
  const groups = t('home.documents.groups', { returnObjects: true }) as DocumentsGroup[]

  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-stretch lg:gap-0">
          {/* Left: requirements, as a plain numbered list (was a 3-card
              grid) — "neeche 1, 2, 3 numbers ke sath details" per the
              redesign brief. */}
          <div className="border border-[#e7e2da] bg-white p-7 sm:p-10 lg:p-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold">
              {t('home.requirements.eyebrow')}
            </p>
            <h2 className="font-hero-serif mt-4 text-3xl font-semibold leading-[1.02] tracking-[-0.06em] text-brand-navy sm:text-4xl">
              {t('home.requirements.title')}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#58616d] sm:text-base sm:leading-7">
              {t('home.requirements.subtitle')}
            </p>

            <ol className="mt-8 space-y-6">
              {items.map((item, i) => (
                <li key={item.title} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-brand-gold text-sm font-semibold text-brand-gold">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold tracking-[-0.01em] text-[#1b2430] sm:text-lg">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#5e6874] sm:text-base sm:leading-7">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Right: one floating dark card holding both document
              checklists (Residents + Visitors) — offset upward on large
              screens (`lg:-mt-8`) plus a deep shadow for the "floating"
              effect over the section's light background. */}
          <div className="relative lg:my-[-24px]">
            <div className="h-full bg-brand-navy p-7 text-white shadow-[0_30px_70px_rgba(7,10,26,0.2)] sm:p-10 lg:p-12">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-champagne">
                {t('home.documents.eyebrow')}
              </p>
              <h3 className="font-hero-serif mt-4 text-3xl font-semibold tracking-[-0.05em] text-white">{t('home.documents.title')}</h3>
              <p className="mt-3 text-sm leading-7 text-white/65">{t('home.documents.subtitle')}</p>

              <div className="mt-6 space-y-6">
                {groups.map((group) => (
                  <div key={group.title}>
                    <p className="border-b border-white/15 pb-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-champagne">{group.title}</p>
                    <ul className="mt-3 space-y-2.5">
                      {group.items.map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold" aria-hidden="true" />
                          <span className="text-sm leading-6 text-white/80">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-xs leading-6 text-white/50">{t('home.documents.note')}</p>
              <Link
                to="/contact"
                className="group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-champagne transition-colors hover:text-white"
              >
                {t('home.documents.contactLink')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
