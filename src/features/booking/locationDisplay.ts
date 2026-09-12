import type { LocationType } from '@/types/database'

/**
 * Shared, framework-free display rules for `locations` rows — the fixed
 * type ordering/icons used by the search widget's location pickers and
 * the public Locations page, kept in one place instead of copied
 * independently in both (as they were before this file existed).
 *
 * Bliss Rent is UAE-only today (see docs/ARCHITECTURE.md and the
 * business-model correction it documents) — `city` is still free-text
 * and fully data-driven (never a hardcoded emirate list), but the
 * customer-facing UI does not expose a country selector, since there is
 * only ever one country to choose. `delivery` stays in the type union
 * because the database enum supports it, but no location currently has
 * that type — nothing here treats it as a customer-chosen category.
 */
export const TYPE_ORDER: LocationType[] = ['airport', 'city', 'hotel', 'delivery']

export const TYPE_ICON: Record<LocationType, string> = {
  airport: '✈',
  city: '🏙',
  hotel: '🏨',
  delivery: '🚚',
}

export function typeOrderIndex(type: LocationType): number {
  const i = TYPE_ORDER.indexOf(type)
  return i === -1 ? TYPE_ORDER.length : i
}

/** Sorts strings alphabetically, except `first` (e.g. the primary city) always sorts to the front. */
export function sortByOrder(a: string, b: string, first: string): number {
  if (a === first) return -1
  if (b === first) return 1
  return a.localeCompare(b)
}
