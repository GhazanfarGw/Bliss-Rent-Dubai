import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchFeaturedVehiclesByCategory } from '@/features/booking/api'
import { VehicleCard } from '@/features/booking/VehicleCard'
import { SectionHeader } from '@/features/shared/ui/SectionHeader'
import { StateMessage } from '@/features/shared/StateMessage'
import type { VehicleWithDetails } from '@/types/domain'

interface FeaturedVehicleSliderProps {
  categoryName: string
  /** Small row label ("Economy Fleet" / "Luxury Fleet") — not a heading:
   *  the section has exactly one shared heading and description above
   *  both rows, so each row only needs enough of a label to tell it apart
   *  from the other. */
  label: string
  viewAllLabel: string
  emptyTitle: string
  emptyBody: string
  /** Which way the row visually auto-scrolls — the two sliders run in
   *  opposite directions so they read as clearly independent, never a
   *  matched pair that could look like one mirrored row. */
  direction: 'left' | 'right'
}

/**
 * One category's own featured-vehicles row — Economy and Luxury each get
 * an independent instance below (own fetch, own loading/empty state, own
 * auto-scrolling row), so growing either side of the fleet never crowds
 * out or gets merged into the other's row. Each row auto-plays
 * continuously (built the same way as BrandsMarquee: the vehicle list
 * duplicated once, animated by exactly -50% for a seamless loop) and
 * pauses on hover or keyboard focus so a shopper can stop and read a
 * card.
 */
function FeaturedVehicleSlider({ categoryName, label, viewAllLabel, emptyTitle, emptyBody, direction }: FeaturedVehicleSliderProps) {
  const { t } = useTranslation()
  const [vehicles, setVehicles] = useState<VehicleWithDetails[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchFeaturedVehiclesByCategory(categoryName)
      .then((data) => {
        if (!cancelled) setVehicles(data)
      })
      .catch(() => {
        if (!cancelled) setError(t('errors.api.SERVER_ERROR'))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryName])

  const loading = vehicles === null && !error

  return (
    <div className="mt-10 first:mt-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-gold-dark">{label}</p>
        {vehicles && vehicles.length > 0 && (
          <Link
            to="/search"
            className="text-sm font-semibold text-brand-navy underline-offset-4 hover:text-brand-gold-dark hover:underline"
          >
            {viewAllLabel}
          </Link>
        )}
      </div>

      <div>
        {loading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-[1.5rem] bg-[#efe7dc]" />
            ))}
          </div>
        )}

        {!loading && (error || !vehicles || vehicles.length === 0) && <StateMessage title={emptyTitle} body={emptyBody} />}

        {!loading && !error && vehicles && vehicles.length > 0 && (
          <div className="overflow-hidden pb-2">
            <div
              className={`flex min-w-max gap-4 sm:gap-6 ${
                direction === 'left' ? 'animate-featured-marquee-left' : 'animate-featured-marquee-right'
              }`}
            >
              {[...vehicles, ...vehicles].map((vehicle, index) => {
                // The second copy exists only to make the loop seamless —
                // hidden from screen readers and keyboard tabbing so it
                // never doubles up reading order or focus stops.
                const isDuplicate = index >= vehicles.length
                return (
                  <div
                    key={`${vehicle.id}-${index}`}
                    aria-hidden={isDuplicate || undefined}
                    inert={isDuplicate}
                    className="w-[82vw] max-w-[320px] shrink-0 rounded-[1.5rem] border border-[#e6dcc7] bg-white p-1 shadow-[0_18px_40px_rgba(16,20,29,0.04)] sm:w-[280px]"
                  >
                    <VehicleCard vehicle={vehicle} detailHref={`/vehicles/${vehicle.id}`} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Homepage "Featured Vehicles" section — one shared heading and
 * description for the whole section, above two independent auto-scrolling
 * rows (Economy, then Luxury, each labeled but never re-titled): adding
 * new vehicles to one category only ever grows that category's own row,
 * never the other's. Real vehicles from the database only (no dates, so
 * VehicleCard falls back to its headline "From <rate>" price), or an
 * honest per-category empty state — never invented cars, prices, or fleet
 * counts.
 */
export function FeaturedVehicles() {
  const { t } = useTranslation()

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeader as="h2" title={t('home.featured.title')} description={t('home.featured.subtitle')} />

      <div className="mt-8">
        <FeaturedVehicleSlider
          categoryName="Economy"
          label={t('home.featured.economy.label')}
          viewAllLabel={t('home.featured.economy.viewAll')}
          emptyTitle={t('home.featured.economy.emptyTitle')}
          emptyBody={t('home.featured.economy.emptyBody')}
          direction="right"
        />

        <FeaturedVehicleSlider
          categoryName="Luxury"
          label={t('home.featured.luxury.label')}
          viewAllLabel={t('home.featured.luxury.viewAll')}
          emptyTitle={t('home.featured.luxury.emptyTitle')}
          emptyBody={t('home.featured.luxury.emptyBody')}
          direction="left"
        />
      </div>
    </section>
  )
}
