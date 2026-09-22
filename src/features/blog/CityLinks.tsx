import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import { CITY_GUIDES } from '@/features/content/cityGuides'

/**
 * Links to every city page ("Car rental in Dubai", "Car rental in Abu
 * Dhabi", …). The link text is the same keyword-rich phrase the city
 * page's own heading uses, so every article that shows this row passes
 * its readers — and its authority — straight to the pages that sell.
 */
export function CityLinks({ heading, body }: { heading: string; body?: string }) {
  const { t, i18n } = useTranslation()
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h2 className="font-hero-serif text-2xl font-semibold tracking-[-0.05em] text-brand-navy sm:text-3xl">{heading}</h2>
      {body && <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">{body}</p>}
      <ul className="mt-5 flex flex-wrap gap-2">
        {CITY_GUIDES.map((guide) => {
          const name = i18n.language === 'ar' ? guide.ar.name : guide.en.name
          return (
            <li key={guide.slug}>
              <Link
                to={`/locations/${guide.slug}`}
                className="inline-flex items-center gap-2 border border-[#e5dfd6] bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-gold hover:text-brand-gold-dark"
              >
                <MapPin className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                {t('pages.cityGuide.title', { city: name })}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
