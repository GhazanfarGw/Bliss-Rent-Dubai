import { describe, it, expect } from 'vitest'
import {
  activeFilterCount,
  applyFilters,
  categoryRank,
  distinctBrands,
  distinctCategories,
  distinctSeats,
  distinctTransmissions,
  priceBounds,
  sortByPrice,
  sortCategoriesPremiumFirst,
  sortLuxuryFirst,
} from '@/lib/vehicleFilters'
import { EMPTY_FILTERS } from '@/types/domain'
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
    // Optional specifications — none entered for this fixture.
    engine: null,
    horsepower: null,
    torque_nm: null,
    top_speed_kmh: null,
    acceleration_0_100: null,
    fuel_type: null,
    fuel_consumption_l100km: null,
    drivetrain: null,
    doors: null,
    origin_country: null,
    about: null,
    about_ar: null,
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
    expect(applyFilters(all, EMPTY_FILTERS)).toHaveLength(3)
  })
  it('filters by category', () => {
    const result = applyFilters(all, { ...EMPTY_FILTERS, categoryId: 'cat-luxury' })
    expect(result.map((v) => v.id)).toEqual(['v2'])
  })
  it('filters by brand', () => {
    const result = applyFilters(all, { ...EMPTY_FILTERS, brands: ['Toyota'] })
    expect(result.map((v) => v.id)).toEqual(['v1'])
  })
  it('keeps every selected brand when several are chosen', () => {
    const result = applyFilters(all, { ...EMPTY_FILTERS, brands: ['Toyota', 'Ford'] })
    expect(result.map((v) => v.id)).toEqual(['v1', 'v2'])
  })
  it('combines multiple filters', () => {
    const result = applyFilters(all, { ...EMPTY_FILTERS, categoryId: 'cat-economy', brands: ['Toyota'], transmission: 'automatic' })
    expect(result.map((v) => v.id)).toEqual(['v1'])
  })
  it('filters by a minimum seat count', () => {
    const cars = [vehicle({ id: 'a', seats: 2 }), vehicle({ id: 'b', seats: 5 }), vehicle({ id: 'c', seats: 7 })]
    expect(applyFilters(cars, { ...EMPTY_FILTERS, minSeats: 5 }).map((v) => v.id)).toEqual(['b', 'c'])
  })
  it('filters by a per-day price range, inclusive at both ends', () => {
    expect(applyFilters(all, { ...EMPTY_FILTERS, priceMin: 150, priceMax: 575 }).map((v) => v.id)).toEqual(['v1', 'v2'])
    expect(applyFilters(all, { ...EMPTY_FILTERS, priceMin: 200 }).map((v) => v.id)).toEqual(['v2'])
    expect(applyFilters(all, { ...EMPTY_FILTERS, priceMax: 200 }).map((v) => v.id)).toEqual(['v1'])
  })
  it('drops vehicles with no rate as soon as a price bound is set', () => {
    expect(applyFilters(all, { ...EMPTY_FILTERS, priceMax: 10_000 }).map((v) => v.id)).toEqual(['v1', 'v2'])
  })
  it('compares a weekly-only vehicle by its per-day equivalent', () => {
    const weeklyOnly = vehicle({
      id: 'w',
      pricing: [{ id: 'pw', vehicle_id: 'w', term: 'weekly', list_price: 900, client_price: 700, currency: 'AED', created_at: '' }],
    })
    expect(applyFilters([weeklyOnly], { ...EMPTY_FILTERS, priceMax: 100 })).toHaveLength(1)
    expect(applyFilters([weeklyOnly], { ...EMPTY_FILTERS, priceMin: 101 })).toHaveLength(0)
  })
})

describe('filter option helpers', () => {
  it('lists distinct seat counts ascending', () => {
    const cars = [vehicle({ id: 'a', seats: 7 }), vehicle({ id: 'b', seats: 2 }), vehicle({ id: 'c', seats: 7 })]
    expect(distinctSeats(cars)).toEqual([2, 7])
  })
  it('reports the per-day price range of the priced fleet, ignoring unpriced cars', () => {
    expect(priceBounds(all)).toEqual({ min: 150, max: 575 })
    expect(priceBounds([noPricingCar])).toBeNull()
  })
  it('counts every active filter, optionally leaving the category out', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
    const busy = { ...EMPTY_FILTERS, categoryId: 'c', brands: ['A', 'B'], transmission: 'manual', minSeats: 4, priceMin: 1, priceMax: 2, availability: 'available' as const }
    expect(activeFilterCount(busy)).toBe(7)
    expect(activeFilterCount(busy, { includeCategory: false })).toBe(6)
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

describe('sortLuxuryFirst', () => {
  const cheapEconomy = vehicle({ id: 'e1' })
  const pricierEconomy = vehicle({
    id: 'e2',
    pricing: [{ id: 'pe2', vehicle_id: 'e2', term: 'daily', list_price: 300, client_price: 250, currency: 'AED', created_at: '' }],
  })
  const suv = vehicle({
    id: 's1',
    vehicle_categories: { id: 'cat-suv', name: 'SUV', description: null, created_at: '' },
  })
  const cheapLuxury = vehicle({
    id: 'l1',
    vehicle_categories: { id: 'cat-luxury', name: 'Luxury', description: null, created_at: '' },
    pricing: [{ id: 'pl1', vehicle_id: 'l1', term: 'daily', list_price: 700, client_price: 500, currency: 'AED', created_at: '' }],
  })

  it('puts Luxury before Economy, with other categories in between', () => {
    const result = sortLuxuryFirst([cheapEconomy, suv, luxurySuv])
    expect(result.map((v) => v.id)).toEqual(['v2', 's1', 'e1'])
  })
  it('keeps the price order within each category after sortByPrice', () => {
    const byPrice = sortByPrice([cheapEconomy, pricierEconomy, luxurySuv, cheapLuxury], 'price_asc', 1)
    expect(sortLuxuryFirst(byPrice).map((v) => v.id)).toEqual(['l1', 'v2', 'e1', 'e2'])
  })
  it('does not mutate the input', () => {
    const input = [cheapEconomy, luxurySuv]
    sortLuxuryFirst(input)
    expect(input.map((v) => v.id)).toEqual(['e1', 'v2'])
  })
})

describe('category display order', () => {
  const named = (id: string, name: string) => vehicle({ id, vehicle_categories: { id: `cat-${id}`, name, description: null, created_at: '' } })

  it('ranks Luxury, Sports & Supercars, SUV, then anything else, then Economy', () => {
    expect(categoryRank('Luxury')).toBeLessThan(categoryRank('Sports & Supercars'))
    expect(categoryRank('Sports & Supercars')).toBeLessThan(categoryRank('SUV'))
    expect(categoryRank('SUV')).toBeLessThan(categoryRank('Convertible'))
    expect(categoryRank('Convertible')).toBeLessThan(categoryRank('Economy'))
  })

  it('treats a missing category like an unknown one', () => {
    expect(categoryRank(null)).toBe(categoryRank('Convertible'))
    expect(categoryRank(undefined)).toBe(categoryRank('Convertible'))
  })

  it('is not thrown off by capitalisation or spacing in the stored name', () => {
    expect(categoryRank('  LUXURY ')).toBe(categoryRank('Luxury'))
    expect(categoryRank('sports & supercars')).toBe(categoryRank('Sports & Supercars'))
  })

  it('sorts a list of categories premium-first, alphabetical among unknown ones, without mutating it', () => {
    const input = [{ name: 'Economy' }, { name: 'Wagon' }, { name: 'SUV' }, { name: 'Convertible' }, { name: 'Luxury' }, { name: 'Sports & Supercars' }]
    expect(sortCategoriesPremiumFirst(input).map((c) => c.name)).toEqual(['Luxury', 'Sports & Supercars', 'SUV', 'Convertible', 'Wagon', 'Economy'])
    expect(input[0].name).toBe('Economy')
  })

  it('groups a fleet by that same order, keeping price order within a category', () => {
    const fleet = [named('e1', 'Economy'), named('s1', 'SUV'), named('sp1', 'Sports & Supercars'), named('l1', 'Luxury'), named('sp2', 'Sports & Supercars')]
    expect(sortLuxuryFirst(fleet).map((v) => v.id)).toEqual(['l1', 'sp1', 'sp2', 's1', 'e1'])
  })
})
