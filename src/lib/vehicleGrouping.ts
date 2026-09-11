import type { VehicleWithDetails } from '@/types/domain'
import { primaryImage } from '@/lib/vehicleImages'

/**
 * Task 1 (2026-09-11 scoped update) — public Fleet publishing + category
 * grouping rules:
 *
 *  1. A master listing (Reserved copies are already excluded upstream —
 *     see the `is_master_listing` filters in src/features/booking/api.ts)
 *     may appear on the public frontend ONLY when it has BOTH a valid
 *     price and at least one valid vehicle image.
 *  2. Frontend category identity is EXACTLY Make + Model + Year. Master
 *     listings sharing all three collapse into ONE card with a combined
 *     quantity; a different year is always a separate card.
 *
 * This never touches Admin Fleet (which must keep showing every master
 * listing regardless of price/image — see FleetListPage.tsx, unchanged)
 * or the database — it's a pure, additive display-layer transform over
 * whatever the existing booking/api.ts queries already return.
 */

/** At least one pricing row with a real, positive rate — reuses the exact same "no pricing" signal VehicleCard/pricing.ts already treat as "nothing to quote". */
export function hasValidPrice(vehicle: VehicleWithDetails): boolean {
  return vehicle.pricing.some((p) => typeof p.client_price === 'number' && p.client_price > 0)
}

/** A resolvable primary/first image with a non-empty storage path — reuses vehicleImages.ts's own "no fabricated fallback photo" resolution. */
export function hasValidImage(vehicle: VehicleWithDetails): boolean {
  const image = primaryImage(vehicle)
  return Boolean(image?.storage_path)
}

export function isEligibleForPublicListing(vehicle: VehicleWithDetails): boolean {
  return hasValidPrice(vehicle) && hasValidImage(vehicle)
}

export interface VehicleGroup<T extends VehicleWithDetails> {
  /** One representative listing from the group — used for the card's photo, price, category chip, etc. (identical vehicles in practice, same make/model/year). */
  vehicle: T
  /** Count of eligible master listings sharing this exact Make + Model + Year — never includes Reserved copies or listings missing a price/image. */
  quantity: number
}

/**
 * Filters to publicly-eligible master listings (rule 3), then groups by
 * Make + Model + Year (rules 4-6), preserving the input order (the
 * representative — and so the group's position — is always whichever
 * member appeared first, so an already-sorted/filtered list stays
 * sorted). Ineligible listings never appear at all, not even folded into
 * another group's quantity.
 */
export function groupPublicVehicles<T extends VehicleWithDetails>(vehicles: T[]): VehicleGroup<T>[] {
  const groups = new Map<string, VehicleGroup<T>>()

  for (const vehicle of vehicles) {
    if (!isEligibleForPublicListing(vehicle)) continue

    const key = `${vehicle.make.trim().toLowerCase()}|${vehicle.model.trim().toLowerCase()}|${vehicle.model_year}`
    const existing = groups.get(key)
    if (existing) {
      existing.quantity += 1
    } else {
      groups.set(key, { vehicle, quantity: 1 })
    }
  }

  return [...groups.values()]
}
