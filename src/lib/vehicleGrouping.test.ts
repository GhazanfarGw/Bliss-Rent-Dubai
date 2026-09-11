import { describe, expect, it } from 'vitest'
import { groupPublicVehicles, hasValidImage, hasValidPrice, isEligibleForPublicListing } from '@/lib/vehicleGrouping'
import type { VehicleWithDetails } from '@/types/domain'

function makeVehicle(overrides: Partial<VehicleWithDetails> & { id: string }): VehicleWithDetails {
  return {
    make: 'Suzuki',
    model: 'Alto VXR',
    model_year: 2025,
    transmission: 'automatic',
    seats: 5,
    status: 'available',
    vehicle_categories: null,
    vehicle_images: [{ id: `img-${overrides.id}`, vehicle_id: overrides.id, storage_path: `${overrides.id}/main.jpg`, is_primary: true, sort_order: 0 }],
    pricing: [{ id: `price-${overrides.id}`, vehicle_id: overrides.id, term: 'daily', list_price: 100, client_price: 90, currency: 'AED' }],
    ...overrides,
  } as unknown as VehicleWithDetails
}

describe('hasValidPrice / hasValidImage', () => {
  it('is false with no pricing rows, or only a zero/invalid rate', () => {
    expect(hasValidPrice(makeVehicle({ id: 'a', pricing: [] } as unknown as Partial<VehicleWithDetails> & { id: string }))).toBe(false)
    expect(
      hasValidPrice(
        makeVehicle({ id: 'b', pricing: [{ id: 'p', vehicle_id: 'b', term: 'daily', list_price: 0, client_price: 0, currency: 'AED' }] } as unknown as Partial<VehicleWithDetails> & { id: string }),
      ),
    ).toBe(false)
  })

  it('is false with no images', () => {
    expect(hasValidImage(makeVehicle({ id: 'c', vehicle_images: [] } as unknown as Partial<VehicleWithDetails> & { id: string }))).toBe(false)
  })

  it('is true once both a real price and an image exist', () => {
    const v = makeVehicle({ id: 'd' })
    expect(hasValidPrice(v)).toBe(true)
    expect(hasValidImage(v)).toBe(true)
    expect(isEligibleForPublicListing(v)).toBe(true)
  })
})

describe('groupPublicVehicles', () => {
  it('collapses identical Make + Model + Year master listings into one group with a combined quantity', () => {
    const vehicles = [makeVehicle({ id: '1' }), makeVehicle({ id: '2' }), makeVehicle({ id: '3' }), makeVehicle({ id: '4' })]
    const groups = groupPublicVehicles(vehicles)
    expect(groups).toHaveLength(1)
    expect(groups[0].quantity).toBe(4)
    expect(groups[0].vehicle.id).toBe('1')
  })

  it('keeps a different model year as a separate group', () => {
    const vehicles = [makeVehicle({ id: '1', model_year: 2025 }), makeVehicle({ id: '2', model_year: 2026 }), makeVehicle({ id: '3', model_year: 2026 })]
    const groups = groupPublicVehicles(vehicles)
    expect(groups).toHaveLength(2)
    const byYear = new Map(groups.map((g) => [g.vehicle.model_year, g.quantity]))
    expect(byYear.get(2025)).toBe(1)
    expect(byYear.get(2026)).toBe(2)
  })

  it('excludes listings missing a valid price or image entirely — never counted, never shown', () => {
    const eligible = makeVehicle({ id: '1' })
    const noPrice = makeVehicle({ id: '2', pricing: [] } as unknown as Partial<VehicleWithDetails> & { id: string })
    const noImage = makeVehicle({ id: '3', vehicle_images: [] } as unknown as Partial<VehicleWithDetails> & { id: string })
    const groups = groupPublicVehicles([eligible, noPrice, noImage])
    expect(groups).toHaveLength(1)
    expect(groups[0].quantity).toBe(1)
  })

  it('groups different makes/models separately', () => {
    const alto = makeVehicle({ id: '1' })
    const camry = makeVehicle({ id: '2', make: 'Toyota', model: 'Camry' })
    const groups = groupPublicVehicles([alto, camry])
    expect(groups).toHaveLength(2)
  })
})
