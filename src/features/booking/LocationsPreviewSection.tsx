import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchLocations } from '@/features/booking/api'
import { prefersReducedMotion } from '@/lib/motion'
import { TYPE_ICON } from '@/features/booking/locationDisplay'
import type { Location } from '@/types/domain'

const PREVIEW_LIMIT = 10

/**
 * Homepage teaser for the full /locations page — a dark band showing a
 * handful of real, active pickup/drop-off points (same fetchLocations()
 * the search widget uses, so this can't drift out of sync with what's
 * actually bookable) plus a "View all locations" button. Honest to
 * Bliss Rent's actual, currently-live coverage (whatever cities exist in
 * `locations` today — no city names are hardcoded here or in the
 * translated copy) rather than a full-UAE door-to-door delivery claim.
 * The business is UAE-wide by design; which cities are actually live is
 * data, not something this component (or its copy) should assume.
 */
export function LocationsPreviewSection() {
  const { t } = useTranslation()
  const [locations, setLocations] = useState<Location[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchLocations()
      .then((data) => {
        if (!cancelled) setLocations(data)
      })
      .catch(() => {
        if (!cancelled) setLocations([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const preview = (locations ?? []).slice(0, PREVIEW_LIMIT)
  const cityNames = Array.from(new Set((locations ?? []).map((l) => l.city)))

  return (
    <section className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold-dark">
          <span className="relative flex h-1.5 w-1.5">
            {!prefersReducedMotion() && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-none bg-brand-champagne opacity-75" />
            )}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-none bg-brand-gold" />
          </span>
          {t('home.locationsPreview.eyebrow')}
        </p>
        <h2 className="font-hero-serif mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-4xl">
          <HighlightCities text={t('home.locationsPreview.title')} cityNames={cityNames} />
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">{t('home.locationsPreview.subtitle')}</p>

        {locations === null && <p className="mt-8 text-sm text-text-muted">{t('home.locationsPreview.loading')}</p>}

        {locations !== null && preview.length === 0 && (
          <p className="mt-8 max-w-xl text-sm text-text-muted">{t('home.locationsPreview.emptyBody')}</p>
        )}

        {preview.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            {preview.map((loc) => {
              // Same real, already-fetched sublabel rule LocationField's
              // picker uses — airport code + city for airport locations,
              // just the city otherwise.
              const sublabel = loc.type === 'airport' && loc.airport_code ? `${loc.airport_code} · ${loc.city}` : loc.city
              return (
                <div
                  key={loc.id}
                  className="inline-flex min-w-0 items-center gap-2 rounded-full border border-brand-gold/30 bg-white px-4 py-2 text-sm font-medium text-[#1f2430] shadow-none transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-(--shadow-card)"
                >
                  <span className="shrink-0 text-base leading-none" aria-hidden="true">{TYPE_ICON[loc.type]}</span>
                  <span className="min-w-0 truncate">
                    {loc.name}
                    <span className="text-text-muted"> · {sublabel}</span>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <Link
          to="/locations"
          className="group mt-10 inline-flex items-center gap-2 border border-brand-gold/60 bg-brand-gold px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_16px_rgba(186,142,92,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(186,142,92,0.32)]"
        >
          {t('home.locationsPreview.viewAll')}
          <ArrowIcon className="h-4 w-4 rtl:rotate-180 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  )
}

/**
 * Highlights any real, currently-live city name in gold within an
 * otherwise white heading — the proper nouns worth the visual accent.
 * Deliberately data-driven from `locations.city` rather than a hardcoded
 * pair of names: this component (and the heading copy it wraps) must
 * keep working unchanged as cities are added or removed, without a code
 * change per city. If no city name appears in the heading text (e.g. a
 * fully generic heading), this simply renders the text unstyled.
 */
function HighlightCities({ text, cityNames }: { text: string; cityNames: string[] }) {
  if (cityNames.length === 0) return <>{text}</>
  const pattern = new RegExp(`(${cityNames.map(escapeRegExp).join('|')})`)
  const parts = text.split(pattern)
  const highlighted = new Set(cityNames)
  return (
    <>
      {parts.map((part, i) =>
        highlighted.has(part) ? (
          <span key={i} className="text-brand-gold">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
