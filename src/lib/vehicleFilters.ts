import type { SortOption, VehicleFilters, VehicleSearchResult, VehicleWithDetails } from '@/types/domain'
import { categoryKey } from '@/lib/categoryName'
import { perDayRate, quoteForDays } from '@/lib/pricing'

/**
 * All filter/sort options below are derived from fields that actually
 * exist on `vehicles` / `vehicle_categories` — no invented "vehicle type"
 * or feature-tag filter, since the schema has no such column.
 */

export function distinctCategories(
  vehicles: VehicleWithDetails[],
): { id: string; name: string }[] {
  const seen = new Map<string, string>()
  for (const v of vehicles) {
    if (v.vehicle_categories) seen.set(v.vehicle_categories.id, v.vehicle_categories.name)
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

export function distinctBrands(vehicles: VehicleWithDetails[]): string[] {
  return [...new Set(vehicles.map((v) => v.make))].sort((a, b) => a.localeCompare(b))
}

export function distinctTransmissions(vehicles: VehicleWithDetails[]): string[] {
  return [...new Set(vehicles.map((v) => v.transmission))].sort((a, b) => a.localeCompare(b))
}

/** Distinct seat counts across the fleet, ascending — the basis for the "N+ seats" filter. */
export function distinctSeats(vehicles: VehicleWithDetails[]): number[] {
  return [...new Set(vehicles.map((v) => v.seats))].sort((a, b) => a - b)
}

/** Lowest and highest per-day rate across the priced fleet (rounded outwards to whole units); null when nothing is priced. */
export function priceBounds(vehicles: VehicleWithDetails[]): { min: number; max: number } | null {
  const rates = vehicles.map((v) => perDayRate(v.pricing)).filter((rate): rate is number => rate != null)
  if (rates.length === 0) return null
  return { min: Math.floor(Math.min(...rates)), max: Math.ceil(Math.max(...rates)) }
}

/** How many filters are set. The category is counted separately by callers that show it elsewhere. */
export function activeFilterCount(filters: VehicleFilters, { includeCategory = true } = {}): number {
  return (
    (includeCategory && filters.categoryId ? 1 : 0) +
    filters.brands.length +
    (filters.transmission ? 1 : 0) +
    (filters.minSeats != null ? 1 : 0) +
    (filters.priceMin != null || filters.priceMax != null ? 1 : 0) +
    (filters.availability ? 1 : 0)
  )
}

export function applyFilters<T extends VehicleWithDetails>(vehicles: T[], filters: VehicleFilters): T[] {
  return vehicles.filter((v) => {
    if (filters.categoryId && v.category_id !== filters.categoryId) return false
    if (filters.brands.length > 0 && !filters.brands.includes(v.make)) return false
    if (filters.transmission && v.transmission !== filters.transmission) return false
    if (filters.minSeats != null && v.seats < filters.minSeats) return false
    if (filters.priceMin != null || filters.priceMax != null) {
      // A vehicle with no rate can't be placed in a price range, so it drops out.
      const rate = perDayRate(v.pricing)
      if (rate == null) return false
      if (filters.priceMin != null && rate < filters.priceMin) return false
      if (filters.priceMax != null && rate > filters.priceMax) return false
    }
    // Only meaningful for dated search results (VehicleSearchResult) — a
    // plain VehicleWithDetails (e.g. browsing with no dates yet) has no
    // `isAvailable` field, so this filter is a no-op for those.
    if (filters.availability && 'isAvailable' in v) {
      const isAvailable = (v as unknown as VehicleSearchResult).isAvailable
      if (filters.availability === 'available' && !isAvailable) return false
      if (filters.availability === 'reserved' && isAvailable) return false
    }
    return true
  })
}

/**
 * Sorts by the quoted total price for the given rental length. Vehicles
 * with no usable pricing at all sort to the end regardless of direction,
 * since there's nothing to compare — they still render, just last.
 */
export function sortByPrice<T extends VehicleWithDetails>(vehicles: T[], sort: SortOption, days: number): T[] {
  const withQuote = vehicles.map((v) => ({ v, quote: quoteForDays(v.pricing, days) }))
  withQuote.sort((a, b) => {
    if (!a.quote && !b.quote) return 0
    if (!a.quote) return 1
    if (!b.quote) return -1
    return sort === 'price_asc'
      ? a.quote.totalPrice - b.quote.totalPrice
      : b.quote.totalPrice - a.quote.totalPrice
  })
  return withQuote.map((x) => x.v)
}

/**
 * The premium-first order categories are shown in, everywhere a list of
 * them appears (search results, the homepage's Featured tabs, the category
 * grid): Luxury, then Sports & Supercars, then SUV, any other category an
 * admin adds after those, and Economy last. Keyed by `categoryKey` so it
 * doesn't depend on capitalisation or punctuation in the stored name.
 */
const PREMIUM_FIRST_ORDER = ['luxury', 'sports_supercars', 'suv']

export function categoryRank(name: string | null | undefined): number {
  if (!name) return PREMIUM_FIRST_ORDER.length
  const key = categoryKey(name)
  if (key === 'economy') return PREMIUM_FIRST_ORDER.length + 1
  const index = PREMIUM_FIRST_ORDER.indexOf(key)
  return index === -1 ? PREMIUM_FIRST_ORDER.length : index
}

/** Categories in the premium-first order above (ties — two unknown categories — fall back to alphabetical). */
export function sortCategoriesPremiumFirst<T extends { name: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => categoryRank(a.name) - categoryRank(b.name) || a.name.localeCompare(b.name))
}

/**
 * Groups the fleet into the premium-first category order (see
 * `categoryRank`). Array#sort is stable, so run this AFTER `sortByPrice`
 * and the chosen price order is preserved within each category.
 */
export function sortLuxuryFirst<T extends VehicleWithDetails>(vehicles: T[]): T[] {
  return [...vehicles].sort((a, b) => categoryRank(a.vehicle_categories?.name) - categoryRank(b.vehicle_categories?.name))
}
