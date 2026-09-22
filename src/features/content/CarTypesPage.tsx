import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SectionHeader } from '@/features/shared/ui/SectionHeader'
import { StateMessage } from '@/features/shared/StateMessage'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import { CurrencySymbol } from '@/features/shared/ui/CurrencySymbol'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import { categoryKey, categoryLabel } from '@/lib/categoryName'
import { sortCategoriesPremiumFirst } from '@/lib/vehicleFilters'
import { primaryImage } from '@/lib/vehicleImages'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import type { VehicleWithDetails } from '@/types/domain'
import { GuidesFooter } from '@/features/blog/GuidesFooter'

interface CategoryBlurb {
  /** categoryKey of the live category this copy belongs to (see src/lib/categoryName.ts). */
  key: string
  tagline: string
  description: string
  idealFor: string
}

interface LiveCategory {
  id: string
  name: string
  photoStoragePath: string | null
  /** Real, live cheapest daily rate across this category's currently
   *  available vehicles — never a hand-typed figure, and absent (not a
   *  converted weekly/monthly rate) when nothing has a `daily` price yet. */
  fromDailyRate: { amount: number; currency: string } | null
  blurb: CategoryBlurb | null
}

/**
 * Marketing overview of the fleet's categories. Previously a purely
 * static page (4 fixed i18n entries with no real ids, so it could never
 * link anywhere specific) — now built from the same live, available-only
 * fleet query FeaturedVehicles/VehicleCategoriesSection already use, so
 * every card has a real category id (deep-linkable to /search), a real
 * representative photo, and a real live "from AED X/day" rate. The
 * longer descriptive copy (tagline/description/idealFor) still comes
 * from pages.carTypes.categories in en.ts/ar.ts — matched to the live
 * category by `key` (categoryKey of its stored name, NOT by a translated
 * name, so it matches in Arabic too) — since that's real marketing
 * content, not data; a live category with no matching static entry (e.g.
 * a newly added category name) still renders honestly with just its real
 * name/photo/price and no invented blurb. Categories are listed
 * premium-first, the same order the search results use.
 */
/** Page content plus a row of hand-picked blog guides underneath it. */
export function CarTypesPage() {
  return (
    <>
      <CarTypesPageContent />
      <GuidesFooter slugs={['economy-sedan-suv-or-luxury-rental-car', 'monthly-and-weekly-car-rental-uae', 'how-to-book-a-rental-car-online-uae']} />
    </>
  )
}

function CarTypesPageContent() {
  const { t } = useTranslation()
  useDocumentTitle(t('pages.carTypes.title'))
  useMetaDescription(t('pages.carTypes.subtitle'))
  const blurbs = t('pages.carTypes.categories', { returnObjects: true }) as CategoryBlurb[]
  const [vehicles, setVehicles] = useState<VehicleWithDetails[] | null>(null)

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

  const categories = summarizeLiveCategories(vehicles ?? [], blurbs)

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <SectionHeader title={t('pages.carTypes.title')} description={t('pages.carTypes.subtitle')} emphasis="marketing" />

      {vehicles === null && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2" aria-hidden="true">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-80 animate-pulse rounded-none bg-brand-lavender/40" />
          ))}
        </div>
      )}

      {vehicles !== null && categories.length === 0 && (
        <div className="mt-8">
          <StateMessage title={t('pages.carTypes.emptyTitle')} body={t('pages.carTypes.emptyBody')} />
        </div>
      )}

      {categories.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/search?category=${cat.id}`}
              className="group overflow-hidden rounded-none border border-brand-navy/10 bg-white shadow-(--shadow-card) transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold hover:shadow-(--shadow-card-hover)"
            >
              <div className="aspect-[16/9] overflow-hidden bg-brand-lavender/60">
                <VehiclePhoto
                  storagePath={cat.photoStoragePath}
                  alt={categoryLabel(t, cat.name)}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-6">
                {cat.blurb && (
                  <span className="inline-block rounded-none bg-brand-lavender px-3 py-1 text-xs font-semibold text-brand-navy">
                    {cat.blurb.tagline}
                  </span>
                )}
                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold text-brand-navy">{categoryLabel(t, cat.name)}</h2>
                  {cat.fromDailyRate && (
                    <p className="text-sm font-semibold text-brand-gold-dark">
                      {t('pages.carTypes.fromDailyPrefix')} <CurrencySymbol currency={cat.fromDailyRate.currency} />{' '}
                      {cat.fromDailyRate.amount.toLocaleString()}
                      {t('pages.carTypes.fromDailySuffix')}
                    </p>
                  )}
                </div>
                {cat.blurb && <p className="mt-2 text-sm leading-relaxed text-text-muted">{cat.blurb.description}</p>}
                {cat.blurb && <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{cat.blurb.idealFor}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-text-muted">{t('pages.carTypes.note')}</p>

      <div className="mt-8 flex justify-center">
        <Link
          to="/search"
          className="rounded-none bg-brand-gold px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold-light"
        >
          {t('pages.carTypes.cta')}
        </Link>
      </div>
    </div>
  )
}

function summarizeLiveCategories(vehicles: VehicleWithDetails[], blurbs: CategoryBlurb[]): LiveCategory[] {
  const blurbByKey = new Map(blurbs.map((b) => [b.key, b]))
  const byId = new Map<string, { name: string; photoStoragePath: string | null; dailyRates: number[]; currency: string | null }>()

  for (const vehicle of vehicles) {
    const category = vehicle.vehicle_categories
    if (!category) continue
    const image = primaryImage(vehicle)
    const dailyRow = vehicle.pricing.find((p) => p.term === 'daily' && p.client_price > 0)
    const existing = byId.get(category.id)
    if (existing) {
      if (!existing.photoStoragePath && image) existing.photoStoragePath = image.storage_path
      if (dailyRow) {
        existing.dailyRates.push(dailyRow.client_price)
        existing.currency = existing.currency ?? dailyRow.currency
      }
    } else {
      byId.set(category.id, {
        name: category.name,
        photoStoragePath: image?.storage_path ?? null,
        dailyRates: dailyRow ? [dailyRow.client_price] : [],
        currency: dailyRow?.currency ?? null,
      })
    }
  }

  return sortCategoriesPremiumFirst(
    Array.from(byId.entries()).map(([id, summary]) => ({
      id,
      name: summary.name,
      photoStoragePath: summary.photoStoragePath,
      fromDailyRate:
        summary.dailyRates.length > 0 && summary.currency
          ? { amount: Math.min(...summary.dailyRates), currency: summary.currency }
          : null,
      blurb: blurbByKey.get(categoryKey(summary.name)) ?? null,
    })),
  )
}
