import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import { fetchLocations } from '@/features/booking/api'
import { CITY_PHOTOS } from '@/features/booking/cityPhotos'
import { cityPagePath } from '@/features/content/cityGuides'
import { sortByOrder, TYPE_ICON, TYPE_ORDER } from '@/features/booking/locationDisplay'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import type { Location } from '@/types/domain'
import type { LocationType } from '@/types/database'
import { GuidesFooter } from '@/features/blog/GuidesFooter'

type ViewState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; locations: Location[] }

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
// Maps each real `locations.type` to the matching already-translated
// section heading (pages.locations.*Heading) — these existed in en.ts/
// ar.ts all along, documented at the top of this file as "grouped by
// type within each city", but were never actually wired up to anything
// until now.
const TYPE_HEADING_KEY: Record<LocationType, string> = {
  airport: 'pages.locations.airportHeading',
  city: 'pages.locations.cityHeading',
  hotel: 'pages.locations.hotelHeading',
  delivery: 'pages.locations.deliveryHeading',
}

/** Page content plus a row of hand-picked blog guides underneath it. */
export function LocationsPage() {
  return (
    <>
      <LocationsPageContent />
      <GuidesFooter slugs={['dubai-airport-car-rental', 'dubai-to-abu-dhabi-road-trip', 'sharjah-and-ajman-by-car']} />
    </>
  )
}

function LocationsPageContent() {
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
    // A real photo of the city itself (see cityPhotos.ts), or none — never
    // a stock image of somewhere else. (This used to be a hardcoded Unsplash
    // map whose "Abu Dhabi" entry was a desk globe and whose fallback for
    // every other city was a lake in Canada.)
    const photo = CITY_PHOTOS[city]
    // Real, live types actually present in this city today — never a
    // fixed list — in the same fixed display order the search widget's
    // pickers use.
    const types = TYPE_ORDER.filter((type) => cityLocations.some((location) => location.type === type))

    return {
      id: city,
      city,
      country,
      photo,
      href: cityPagePath(city) ?? '/search',
      types,
      pointCount: cityLocations.length,
    }
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-hero-serif text-3xl font-semibold text-brand-navy sm:text-4xl">{t('pages.locations.title')}</h1>
        <p className="mt-2 text-sm text-text-muted">{t('pages.locations.subtitle')}</p>
      </div>

      {state.status === 'loading' && <p className="mt-8 text-sm text-text-muted">{t('pages.locations.loading')}</p>}

      {(state.status === 'error' || isEmpty) && (
        <div className="mt-8 rounded-2xl border border-brand-navy/10 bg-brand-lavender/30 px-5 py-6 text-center">
          <p className="text-sm font-semibold text-brand-navy">{t('pages.locations.emptyTitle')}</p>
          <p className="mt-1 text-sm text-text-muted">{t('pages.locations.emptyBody')}</p>
        </div>
      )}

      {state.status === 'loaded' && !isEmpty && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {cityCards.map(({ id, city, country, photo, href, types, pointCount }) => (
            <Link
              key={id}
              to={href}
              className="group overflow-hidden rounded-2xl border border-border bg-white shadow-[0_8px_24px_rgba(32,28,59,0.06)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(32,28,59,0.12)]"
            >
              <div className="relative h-64 bg-brand-lavender">
                {photo ? (
                  <>
                    <img src={photo.largeSrc} alt={city} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    {/* The photo's author/license credit (CC BY / CC BY-SA
                        require it) — the linked source is on the city page
                        this card opens. */}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 pb-1.5 pt-5 text-[9px] text-white/85">
                      {t('pages.cityGuide.photoBy', { author: photo.author, license: photo.license })}
                    </span>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-brand-gold/40">
                    <MapPin className="h-12 w-12" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="px-6 pb-7 pt-5 text-brand-navy">
                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-text-muted">{country.toUpperCase()}</p>
                <h2 className="mt-5 text-xl font-semibold leading-[1.05] tracking-[-0.04em] text-brand-navy">
                  {city}
                </h2>

                {/* Real location types actually available in this city
                    today (never a fixed list) — the same type icons
                    LocationField's picker and LocationsPreviewSection
                    use, paired with the translated headings this page's
                    own file already carried but never rendered. */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {types.map((type) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1.5 border border-border bg-surface-warm px-2.5 py-1 text-xs font-medium text-brand-navy"
                    >
                      <span aria-hidden="true">{TYPE_ICON[type]}</span>
                      {t(TYPE_HEADING_KEY[type])}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-sm text-text-muted">{t('pages.locations.pointCount', { count: pointCount })}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-text-muted">{t('pages.locations.note')}</p>

      <div className="mt-8 flex justify-center">
        <Link
          to="/search"
          className="rounded-full bg-brand-gold px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold-light"
        >
          {t('pages.locations.cta')}
        </Link>
      </div>
    </div>
  )
}
