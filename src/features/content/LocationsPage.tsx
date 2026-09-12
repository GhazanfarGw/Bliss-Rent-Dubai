import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchLocations } from '@/features/booking/api'
import { sortByOrder } from '@/features/booking/locationDisplay'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import type { Location } from '@/types/domain'

type ViewState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; locations: Location[] }

const CITY_IMAGE_MAP: Record<string, string> = {
  Dubai:
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80&fm=jpg',
  'Abu Dhabi':
    'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80&fm=jpg',
}

/**
 * Live "where can I pick up / drop off" page — pulls real, active rows
 * from the `locations` table (the same `fetchLocations()` the search
 * widget and checkout use) rather than a hardcoded list of areas, so this
 * page can never drift out of sync with what's actually bookable.
 *
 * UAE-wide by design: locations are grouped first by `city` — whichever
 * cities actually exist in the data today (Dubai and Abu Dhabi right now,
 * with more added purely as new rows, never a code change) — then by
 * `location_type` (airport / city-area / hotel-accommodation / delivery,
 * whichever types actually have entries in that city) within each city.
 * See docs/ARCHITECTURE.md. Each group's heading is built as
 * "{city} — {type heading}" (a dash-joined format, not a sentence)
 * specifically so it reads correctly in both English and Arabic without
 * needing a separate translated heading per city.
 */
export function LocationsPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('pages.locations.title'))
  useMetaDescription(t('pages.locations.subtitle'))
  const [state, setState] = useState<ViewState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchLocations()
      .then((locations) => {
        if (!cancelled) setState({ status: 'loaded', locations })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const locations = state.status === 'loaded' ? state.locations : []
  const cityNames = Array.from(new Set(locations.map((l) => l.city))).sort((a, b) => sortByOrder(a, b, 'Dubai'))
  const isEmpty = state.status === 'loaded' && locations.length === 0

  const cityCards = cityNames.map((city) => {
    const cityLocations = locations.filter((location) => location.city === city)
    const country = cityLocations[0]?.country ?? city
    const image = CITY_IMAGE_MAP[city] ?? 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80'

    return {
      id: city,
      city,
      country,
      image,
    }
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-2xl font-bold text-brand-navy sm:text-3xl">{t('pages.locations.title')}</h1>
        <p className="mt-2 text-sm text-text-muted">{t('pages.locations.subtitle')}</p>
      </div>

      {state.status === 'loading' && <p className="mt-8 text-sm text-text-muted">{t('pages.locations.loading')}</p>}

      {(state.status === 'error' || isEmpty) && (
        <div className="mt-8 rounded-xl border border-brand-navy/10 bg-brand-lavender/30 px-5 py-6 text-center">
          <p className="text-sm font-semibold text-brand-navy">{t('pages.locations.emptyTitle')}</p>
          <p className="mt-1 text-sm text-text-muted">{t('pages.locations.emptyBody')}</p>
        </div>
      )}

      {state.status === 'loaded' && !isEmpty && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {cityCards.map(({ id, city, country, image }) => (
            <Link
              key={id}
              to="/search"
              className="group overflow-hidden rounded-[20px] border border-border bg-white shadow-[0_8px_24px_rgba(32,28,59,0.06)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(32,28,59,0.12)]"
            >
              <div
                className="h-64 bg-cover bg-center bg-no-repeat"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.08)), url(${image})`,
                }}
              />

              <div className="px-6 pb-7 pt-5 text-brand-navy">
                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-text-muted">{country.toUpperCase()}</p>
                <h2 className="mt-5 text-xl font-semibold leading-[1.05] tracking-[-0.04em] text-brand-navy">
                  {city}
                </h2>

                <div className="mt-6 space-y-1 text-base text-text-muted">
                  <p>Book until 31 Aug 26</p>
                  <p>Economy Class Return</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-text-muted">{t('pages.locations.note')}</p>

      <div className="mt-8 flex justify-center">
        <Link
          to="/search"
          className="rounded-lg bg-brand-gold px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold-light"
        >
          {t('pages.locations.cta')}
        </Link>
      </div>
    </div>
  )
}
