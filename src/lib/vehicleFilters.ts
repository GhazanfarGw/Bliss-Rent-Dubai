import type { SortOption, VehicleFilters, VehicleSearchResult, VehicleWithDetails } from '@/types/domain'
import { quoteForDays } from '@/lib/pricing'

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

export function applyFilters<T extends VehicleWithDetails>(vehicles: T[], filters: VehicleFilters): T[] {
  return vehicles.filter((v) => {
    if (filters.categoryId && v.category_id !== filters.categoryId) return false
    if (filters.brand && v.make !== filters.brand) return false
    if (filters.transmission && v.transmission !== filters.transmission) return false
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
