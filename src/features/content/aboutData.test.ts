import { describe, it, expect } from 'vitest'
import { formatRange, summarizeCoverage, summarizeFleet } from '@/features/content/aboutData'
import type { Location, VehicleWithDetails } from '@/types/domain'

function location(overrides: Partial<Location> & { id: string; city: string; type: Location['type'] }): Location {
  return { name: overrides.id, country: 'United Arab Emirates', airport_code: null, ...overrides } as Location
}

function vehicle(overrides: Partial<VehicleWithDetails> & { id: string; categoryId: string }): VehicleWithDetails {
  const { categoryId, ...rest } = overrides
  return {
    make: 'Toyota',
    model: 'Camry',
    model_year: 2023,
    transmission: 'automatic',
    seats: 5,
    category_id: categoryId,
    vehicle_categories: { id: categoryId, name: categoryId },
    ...rest,
  } as unknown as VehicleWithDetails
}

describe('summarizeCoverage', () => {
  const rows = [
    location({ id: 'sh-city', city: 'Sharjah', type: 'city' }),
    location({ id: 'dxb-t1', city: 'Dubai', type: 'airport', airport_code: 'DXB' }),
    location({ id: 'dxb-t3', city: 'Dubai', type: 'airport', airport_code: 'DXB' }),
    location({ id: 'dwc', city: 'Dubai', type: 'airport', airport_code: 'DWC' }),
    location({ id: 'dxb-hotel', city: 'Dubai', type: 'hotel' }),
    location({ id: 'auh', city: 'Abu Dhabi', type: 'airport', airport_code: 'AUH' }),
  ]

  it('lists Dubai first, then the other cities alphabetically', () => {
    expect(summarizeCoverage(rows).cities.map((c) => c.city)).toEqual(['Dubai', 'Abu Dhabi', 'Sharjah'])
  })

  it('counts an airport once even when it has several terminals listed', () => {
    const summary = summarizeCoverage(rows)
    expect(summary.airportCount).toBe(3) // DXB (2 terminals), DWC, AUH
    expect(summary.countsByType.airport).toBe(4) // but four airport pickup points
    expect(summary.pointCount).toBe(6)
  })

  it('reports the types present in each city in the fixed display order', () => {
    const dubai = summarizeCoverage(rows).cities[0]
    expect(dubai.types).toEqual(['airport', 'hotel'])
    expect(dubai.points).toHaveLength(4)
  })

  it('is empty-safe', () => {
    expect(summarizeCoverage([])).toEqual({
      cities: [],
      pointCount: 0,
      airportCount: 0,
      countsByType: { airport: 0, city: 0, hotel: 0, delivery: 0 },
    })
  })
})

describe('summarizeFleet', () => {
  it('derives brands, categories, year and seat ranges from the live vehicles', () => {
    const summary = summarizeFleet([
      vehicle({ id: 'v1', categoryId: 'eco', make: 'Toyota', model_year: 2023, seats: 5 }),
      vehicle({ id: 'v2', categoryId: 'lux', make: 'Ferrari', model_year: 2024, seats: 2 }),
      vehicle({ id: 'v3', categoryId: 'lux', make: 'Toyota', model_year: 2024, seats: 7 }),
    ])
    expect(summary.vehicleCount).toBe(3)
    expect(summary.categoryCount).toBe(2)
    expect(summary.brands).toEqual(['Ferrari', 'Toyota'])
    expect(summary.transmissions).toEqual(['automatic'])
    expect(summary.yearRange).toEqual([2023, 2024])
    expect(summary.seatRange).toEqual([2, 7])
  })

  it('has no ranges for an empty fleet', () => {
    const summary = summarizeFleet([])
    expect(summary.yearRange).toBeNull()
    expect(summary.seatRange).toBeNull()
    expect(summary.brands).toEqual([])
  })
})

describe('formatRange', () => {
  it('collapses a single-value range', () => {
    expect(formatRange([2023, 2023])).toBe('2023')
    expect(formatRange([2023, 2024])).toBe('2023–2024')
  })
})
