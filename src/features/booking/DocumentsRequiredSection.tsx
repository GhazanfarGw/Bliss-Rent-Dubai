import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { SectionHeader } from '@/features/shared/ui/SectionHeader'

interface DocumentsGroup {
  title: string
  items: string[]
}

/**
 * "Documents required" homepage section (Phase 11 redesign) — structurally
 * inspired by the owner's reference (a resident/tourist document
 * checklist), rendered as an ORIGINAL Bliss Rent treatment using our own
 * brand palette and Lucide icons rather than stock photography (this app
 * only ever shows real, licensed photos — see VehiclePhoto — so a section
 * with no real photo of its own uses icons, never an invented stock
 * image). The two lists are standard, publicly documented UAE car-rental
 * requirements (a UAE driving license + Emirates ID for residents;
 * passport, UAE entry/visit visa, home driving license, and an
 * International Driving Permit for visitors whose license needs one) —
 * the same requirement RequirementsSection above already references more
 * briefly; this section just breaks it out by traveler type. Nothing here
 * is specific to any customer or booking, so there's no live data to fetch
 * or fabricate.
 */
export function DocumentsRequiredSection() {
  const { t } = useTranslation()
  const groups = t('home.documents.groups', { returnObjects: true }) as DocumentsGroup[]

  return (
    <section className="bg-surface-warm-alt">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeader as="h2" title={t('home.documents.title')} description={t('home.documents.subtitle')} />

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {groups.map((group) => (
            <div
              key={group.title}
              className="overflow-hidden border border-[#e7dcc7] bg-white shadow-(--shadow-card) transition-all duration-300 hover:-translate-y-1 hover:shadow-(--shadow-card-hover)"
            >
              <div className="bg-brand-gold px-6 py-4">
                <h3 className="text-base font-bold tracking-tight text-white">{group.title}</h3>
              </div>
              <ul className="space-y-3.5 p-6">
                {group.items.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-navy" aria-hidden="true" />
                    <span className="text-sm leading-6 text-brand-navy sm:text-base">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-3xl text-sm leading-7 text-text-muted">{t('home.documents.note')}</p>
        <Link
          to="/contact"
          className="group mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-gold transition-colors hover:text-brand-gold-dark"
        >
          {t('home.documents.contactLink')}
          <ArrowRight className="h-4 w-4 rtl:rotate-180 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
