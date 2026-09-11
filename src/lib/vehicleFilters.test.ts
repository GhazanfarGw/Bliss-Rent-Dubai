import { describe, it, expect } from 'vitest'
import {
  applyFilters,
  distinctBrands,
  distinctCategories,
  distinctTransmissions,
  sortByPrice,
} from '@/lib/vehicleFilters'
import type { VehicleWithDetails } from '@/types/domain'

function vehicle(overrides: Partial<VehicleWithDetails>): VehicleWithDetails {
  return {
    id: overrides.id ?? 'v1',
    category_id: 'cat-economy',
    make: 'Toyota',
    model: 'Corolla',
    model_year: 2024,
    transmission: 'automatic',
    seats: 5,
    plate_number: 'A-1',
    status: 'available',
    created_at: '2026-01-01T00:00:00Z',
    // Phase 14 — search/filter results are always master listings
    // (available_vehicles() only ever returns is_master_listing = true
    // rows), so that's the correct default for this fixture too.
    is_master_listing: true,
    master_vehicle_id: null,
    vehicle_categories: { id: 'cat-economy', name: 'Economy', description: null, created_at: '' },
    vehicle_images: [],
    pricing: [
      {
        id: 'p1',
        vehicle_id: overrides.id ?? 'v1',
        term: 'daily',
        list_price: 200,
        client_price: 150,
        currency: 'AED',
        created_at: '',
      },
    ],
    ...overrides,
  }
}

const economySedan = vehicle({ id: 'v1', make: 'Toyota', transmission: 'automatic' })
const luxurySuv = vehicle({
  id: 'v2',
  make: 'Ford',
  transmission: 'manual',
  category_id: 'cat-luxury',
  vehicle_categories: { id: 'cat-luxury', name: 'Luxury', description: null, created_at: '' },
  pricing: [
    { id: 'p2', vehicle_id: 'v2', term: 'daily', list_price: 900, client_price: 575, currency: 'AED', created_at: '' },
  ],
})
const noPricingCar = vehicle({ id: 'v3', make: 'Honda', pricing: [] })

const all = [economySedan, luxurySuv, noPricingCar]

describe('distinct* helpers', () => {
  it('lists distinct categories', () => {
    expect(distinctCategories(all).map((c) => c.name)).toEqual(['Economy', 'Luxury'])
  })
  it('lists distinct brands sorted', () => {
    expect(distinctBrands(all)).toEqual(['Ford', 'Honda', 'Toyota'])
  })
  it('lists distinct transmissions sorted', () => {
    expect(distinctTransmissions(all)).toEqual(['automatic', 'manual'])
  })
})

describe('applyFilters', () => {
  it('returns everything with no filters set', () => {
    expect(applyFilters(all, { categoryId: null, brand: null, transmission: null, availability: null })).toHaveLength(3)
  })
  it('filters by category', () => {
    const result = applyFilters(all, { categoryId: 'cat-luxury', brand: null, transmission: null, availability: null })
    expect(result.map((v) => v.id)).toEqual(['v2'])
  })
  it('filters by brand', () => {
    const result = applyFilters(all, { categoryId: null, brand: 'Toyota', transmission: null, availability: null })
    expect(result.map((v) => v.id)).toEqual(['v1'])
  })
  it('combines multiple filters', () => {
    const result = applyFilters(all, { categoryId: 'cat-economy', brand: 'Toyota', transmission: 'automatic', availability: null })
    expect(result.map((v) => v.id)).toEqual(['v1'])
  })
})

describe('sortByPrice', () => {
  it('sorts ascending by quoted total, unpriced vehicles last', () => {
    // v1 (Toyota) quotes AED 150/day, v2 (Ford) quotes AED 575/day.
    const result = sortByPrice(all, 'price_asc', 1)
    expect(result.map((v) => v.id)).toEqual(['v1', 'v2', 'v3'])
  })
  it('sorts descending by quoted total, unpriced vehicles still last', () => {
    const result = sortByPrice(all, 'price_desc', 1)
    expect(result.map((v) => v.id)).toEqual(['v2', 'v1', 'v3'])
  })
})
