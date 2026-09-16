import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchFeaturedVehiclesByCategory } from '@/features/booking/api'
import { VehicleCard } from '@/features/booking/VehicleCard'
import { SectionHeader } from '@/features/shared/ui/SectionHeader'
import { StateMessage } from '@/features/shared/StateMessage'
import { groupPublicVehicles } from '@/lib/vehicleGrouping'
import type { VehicleWithDetails } from '@/types/domain'

type Category = 'Economy' | 'Luxury'
const CATEGORIES: Category[] = ['Economy', 'Luxury']

/**
 * Homepage "Featured Vehicles" section. Redesign: replaces the old
 * "both categories always visible, each its own auto-scrolling marquee
 * row" layout with a single Economy/Luxury pill toggle above ONE
 * auto-scrolling row — one category's real vehicles visible at a time,
 * refetched on toggle (`fetchFeaturedVehiclesByCategory`, unchanged). No
 * existing Tabs/SegmentedControl primitive exists in
 * src/features/shared/ui/, so the toggle is built inline here rather
 * than as a new shared component, since it's a one-off.
 *
 * Per owner feedback after the first pass (toggle kept, static grid
 * reverted): the active category's cards auto-scroll exactly like the
 * old dual-marquee version did — same duplicate-the-list-once trick and
 * `animate-featured-marquee-left/right` keyframes (index.css), just
 * driven by one row instead of two. Direction still alternates by
 * category (Economy right, Luxury left) purely so switching tabs reads
 * as a visibly different row, not because two rows run at once anymore.
 *
 * Real vehicles from the database only (no dates, so VehicleCard falls
 * back to its headline "From <rate>" price), or an honest empty state —
 * never invented cars, prices, or fleet counts.
 */
export function FeaturedVehicles() {
  const { t } = useTranslation()
  const [category, setCategory] = useState<Category>('Economy')
  const [vehicles, setVehicles] = useState<VehicleWithDetails[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setVehicles(null)
    setError(null)
    fetchFeaturedVehiclesByCategory(category)
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
  }, [category])

  const loading = vehicles === null && !error
  // Same Make + Model + Year master listings collapse into one featured
  // card with a combined quantity; see SearchResultsPage for the
  // identical rule applied to search results.
  const grouped = vehicles ? groupPublicVehicles(vehicles) : []
  const copy = category === 'Economy' ? t('home.featured.economy', { returnObjects: true }) : t('home.featured.luxury', { returnObjects: true })
  const { label, emptyTitle, emptyBody } = copy as { label: string; viewAll: string; emptyTitle: string; emptyBody: string }

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeader as="h2" title={t('home.featured.title')} description={t('home.featured.subtitle')} emphasis="marketing" />

      {/* Economy/Luxury pill toggle — a plain two-button segmented
          control, not an extracted shared component (see doc comment
          above). aria-pressed marks the active side for screen readers. */}
      <div className="mt-6 inline-flex border border-brand-gold/30 p-1 rounded-full" role="group" aria-label={label}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            aria-pressed={cat === category}
            onClick={() => setCategory(cat)}
            className={
              'rounded-full px-6 py-2 text-sm font-semibold transition-colors duration-200 ' +
              (cat === category ? 'bg-brand-gold text-white' : 'text-brand-navy hover:bg-brand-lavender')
            }
          >
            {t(`home.featured.${cat.toLowerCase()}.label`)}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {loading && (
          <div className="flex gap-5 overflow-hidden" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-72 w-[82vw] max-w-[320px] shrink-0 animate-pulse rounded-none bg-[#efe7dc] sm:w-[280px]" />
            ))}
          </div>
        )}

        {!loading && (error || !vehicles || grouped.length === 0) && <StateMessage title={emptyTitle} body={emptyBody} />}

        {!loading && !error && vehicles && grouped.length > 0 && (
          <div className="overflow-hidden pb-2 [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
            <div
              key={category}
              className={
                'flex min-w-max gap-4 sm:gap-6 ' +
                (category === 'Economy' ? 'animate-featured-marquee-right' : 'animate-featured-marquee-left')
              }
            >
              {[...grouped, ...grouped].map((group, index) => {
                // The second copy exists only to make the loop seamless —
                // hidden from screen readers and keyboard tabbing so it
                // never doubles up reading order or focus stops.
                const isDuplicate = index >= grouped.length
                return (
                  <div
                    key={`${group.vehicle.id}-${index}`}
                    aria-hidden={isDuplicate || undefined}
                    inert={isDuplicate}
                    className="w-[82vw] max-w-[320px] shrink-0 rounded-none border border-[#e6dcc7] bg-white p-1 shadow-(--shadow-card) transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold/50 hover:shadow-(--shadow-card-hover) sm:w-[280px]"
                  >
                    <VehicleCard vehicle={group.vehicle} detailHref={`/vehicles/${group.vehicle.id}`} featured quantity={group.quantity} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
