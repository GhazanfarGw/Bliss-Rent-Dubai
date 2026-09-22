import { sortByOrder, TYPE_ORDER } from '@/features/booking/locationDisplay'
import { distinctBrands, distinctCategories, distinctTransmissions } from '@/lib/vehicleFilters'
import type { Location, VehicleWithDetails } from '@/types/domain'
import type { LocationType } from '@/types/database'

/**
 * Pure summaries of the live `locations` / `vehicles` rows for the About
 * page's company-profile sections. Everything here is derived from data the
 * booking system already serves — nothing is hardcoded, so the figures the
 * page shows can't drift from what's actually bookable.
 */

export interface CityCoverage {
  city: string
  points: Location[]
  /** Types actually present in this city, in the fixed TYPE_ORDER. */
  types: LocationType[]
}

export interface CoverageSummary {
  /** Dubai first, the rest alphabetical (same order as the Locations page). */
  cities: CityCoverage[]
  pointCount: number
  /** Distinct airports, not airport pickup points — DXB's two terminals are one airport. */
  airportCount: number
  countsByType: Record<LocationType, number>
}

export function summarizeCoverage(locations: Location[]): CoverageSummary {
  const cityNames = Array.from(new Set(locations.map((location) => location.city))).sort((a, b) => sortByOrder(a, b, 'Dubai'))
  const cities = cityNames.map((city) => {
    const points = locations.filter((location) => location.city === city)
    const types = TYPE_ORDER.filter((type) => points.some((point) => point.type === type))
    return { city, points, types }
  })

  const countsByType: Record<LocationType, number> = { airport: 0, city: 0, hotel: 0, delivery: 0 }
  for (const location of locations) countsByType[location.type] += 1

  const airports = locations.filter((location) => location.type === 'airport')
  const airportCount = new Set(airports.map((airport) => airport.airport_code ?? airport.name)).size

  return { cities, pointCount: locations.length, airportCount, countsByType }
}

export interface FleetSummary {
  vehicleCount: number
  categoryCount: number
  brands: string[]
  transmissions: string[]
  yearRange: [number, number] | null
  seatRange: [number, number] | null
}

export function summarizeFleet(vehicles: VehicleWithDetails[]): FleetSummary {
  return {
    vehicleCount: vehicles.length,
    categoryCount: distinctCategories(vehicles).length,
    brands: distinctBrands(vehicles),
    transmissions: distinctTransmissions(vehicles),
    yearRange: rangeOf(vehicles.map((vehicle) => vehicle.model_year)),
    seatRange: rangeOf(vehicles.map((vehicle) => vehicle.seats)),
  }
}

function rangeOf(values: (number | null | undefined)[]): [number, number] | null {
  const numbers = values.filter((value): value is number => typeof value === 'number')
  if (numbers.length === 0) return null
  return [Math.min(...numbers), Math.max(...numbers)]
}

/** "2023" when the range is a single value, "2023–2024" otherwise. */
export function formatRange([min, max]: [number, number]): string {
  return min === max ? String(min) : `${min}–${max}`
}
