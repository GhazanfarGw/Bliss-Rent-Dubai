import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import { SectionHeader } from '@/features/shared/ui/SectionHeader'
import { StateMessage } from '@/features/shared/StateMessage'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import { primaryImage } from '@/lib/vehicleImages'
import type { VehicleWithDetails } from '@/types/domain'

/** How many category cards show before "See more" — matches the desktop
 *  5-column grid at two full rows. */
const INITIAL_VISIBLE_COUNT = 10

interface CategorySummary {
  id: string
  name: string
  /** Storage path of a real photo borrowed from one of this category's
   *  currently available vehicles — null when none of them has a photo
   *  yet yet (VehiclePhoto then renders its neutral placeholder, never a
   *  stand-in stock photo). */
  photoStoragePath: string | null
  /** Live count of currently available vehicles in this category — never
   *  a fabricated number. */
  availableCount: number
}

/**
 * Live, photo-led category browser (Phase 11 header/hero/homepage
 * redesign) — replaces the earlier text-only category list with a
 * professional photo-grid pattern (image, name, live available count per
 * card), inspired structurally by the owner's reference (an airline-style
 * "browse by category" grid); an ORIGINAL Bliss Rent treatment using our
 * own brand palette, not a visual copy. Every photo and count comes from
 * the SAME live, available-only fleet query FeaturedVehicles/
 * VehicleCard already use — no invented cars, categories, or counts, and
 * no second fleet-fetching path.
 */
export function VehicleCategoriesSection() {
  const { t } = useTranslation()
  const [vehicles, setVehicles] = useState<VehicleWithDetails[] | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchAllAvailableVehicles()
      .then((data) => {
        if (!cancelled) setVehicles(data)
      })
      .catch(() => {
        if (!cancelled) setVehicles([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const categories = summarizeCategories(vehicles ?? [])
  const visibleCategories = expanded ? categories : categories.slice(0, INITIAL_VISIBLE_COUNT)
  const hasMore = !expanded && categories.length > INITIAL_VISIBLE_COUNT

  return (
    <section className="bg-[#f5f1ea]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeader as="h2" title={t('home.categories.title')} description={t('home.categories.subtitle')} />

        {vehicles === null && (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="aspect-[4/3] animate-pulse rounded-2xl bg-[#efe7dc]" />
            ))}
          </div>
        )}

        {vehicles !== null && categories.length === 0 && (
          <StateMessage title={t('home.categories.emptyTitle')} body={t('home.categories.emptyBody')} />
        )}

        {categories.length > 0 && (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {visibleCategories.map((category) => (
                <Link
                  key={category.id}
                  to="/search"
                  className="group overflow-hidden rounded-2xl border border-[#e7dcc7] bg-white shadow-[0_16px_38px_rgba(16,20,29,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold hover:shadow-[0_22px_48px_rgba(16,20,29,0.1)] focus:outline-none focus:ring-2 focus:ring-brand-gold focus:ring-offset-2"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-brand-lavender/60">
                    <VehiclePhoto
                      storagePath={category.photoStoragePath}
                      alt={category.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-bold tracking-tight text-brand-navy sm:text-base">{category.name}</h3>
                    <p className="mt-1 text-sm text-text-muted">{t('home.categories.carsCount', { count: category.availableCount })}</p>
                  </div>
                </Link>
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-navy/15 bg-white px-6 py-3 text-sm font-semibold text-brand-navy shadow-sm transition-colors hover:border-brand-gold hover:text-brand-gold-dark"
                >
                  {t('home.categories.seeMore')}
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

/** Groups the same live, available-only vehicle list FeaturedVehicles/
 *  VehicleCard already fetch into one summary per category — a live count
 *  plus one real representative photo (the first available vehicle in
 *  that category that actually has a photo). Pure and easy to unit-test
 *  in isolation from the fetch/render. */
function summarizeCategories(vehicles: VehicleWithDetails[]): CategorySummary[] {
  const byId = new Map<string, CategorySummary>()
  for (const vehicle of vehicles) {
    const category = vehicle.vehicle_categories
    if (!category) continue
    const image = primaryImage(vehicle)
    const existing = byId.get(category.id)
    if (existing) {
      existing.availableCount += 1
      if (!existing.photoStoragePath && image) existing.photoStoragePath = image.storage_path
    } else {
      byId.set(category.id, {
        id: category.id,
        name: category.name,
        photoStoragePath: image?.storage_path ?? null,
        availableCount: 1,
      })
    }
  }
  return Array.from(byId.values())
}
