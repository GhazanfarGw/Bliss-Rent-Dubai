import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chainable } from '@/test/supabaseMock'
import { EMPTY_VEHICLE_DRAFT } from '@/types/domain'

const fromMock = vi.fn()
const storageRemoveMock = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    storage: { from: () => ({ remove: (...args: unknown[]) => storageRemoveMock(...args) }) },
  },
}))

const { fetchVehicles, createVehicle, updateVehicle, updateVehicleStatus, deleteVehicle } = await import('./adminFleetApi')

describe('adminFleetApi', () => {
  beforeEach(() => {
    fromMock.mockReset()
    storageRemoveMock.mockReset()
    storageRemoveMock.mockResolvedValue({ data: null, error: null })
  })

  it('merges vehicles with their operational status, without re-deriving the classification (Fleet Management)', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'vehicles') {
        return chainable({ data: [{ id: 'v1', make: 'Toyota', model: 'Camry', pricing: [], vehicle_images: [] }] })
      }
      if (table === 'vehicle_operational_status') {
        return chainable({ data: [{ vehicle_id: 'v1', operational_status: 'rented' }] })
      }
      throw new Error(`unexpected table ${table}`)
    })

    const vehicles = await fetchVehicles()
    expect(vehicles).toHaveLength(1)
    expect(vehicles[0].operational_status).toBe('rented')
  })

  it('defaults to available when no operational_status row exists yet', async () => {
    fromMock.mockImplementation((table: string) =>
      table === 'vehicles' ? chainable({ data: [{ id: 'v2' }] }) : chainable({ data: [] }),
    )
    const vehicles = await fetchVehicles()
    expect(vehicles[0].operational_status).toBe('available')
  })

  it('creates a vehicle from a draft and returns its new id (Add Vehicle)', async () => {
    fromMock.mockReturnValue(chainable({ data: { id: 'new-vehicle-id' } }))
    const id = await createVehicle({ ...EMPTY_VEHICLE_DRAFT, categoryId: 'cat-1', make: 'Nissan', model: 'Altima', plateNumber: 'B99999' })
    expect(id).toBe('new-vehicle-id')
    expect(fromMock).toHaveBeenCalledWith('vehicles')
  })

  it('stores blank specification fields as NULL and entered ones as real numbers / trimmed text', async () => {
    let inserted: Record<string, unknown> | undefined
    fromMock.mockReturnValue({
      insert: (row: Record<string, unknown>) => {
        inserted = row
        return chainable({ data: { id: 'new-vehicle-id' } })
      },
    })
    await createVehicle({
      ...EMPTY_VEHICLE_DRAFT,
      categoryId: 'cat-1',
      make: 'Nissan',
      model: 'Altima',
      plateNumber: 'B99999',
      engine: '  2.5L 4-cylinder  ',
      horsepower: '188',
      acceleration0100: '',
      fuelConsumptionL100km: '7.4',
      about: '   ',
    })

    expect(inserted).toMatchObject({
      engine: '2.5L 4-cylinder',
      horsepower: 188,
      fuel_consumption_l100km: 7.4,
      // Left blank: NULL, never 0 or an empty string.
      torque_nm: null,
      top_speed_kmh: null,
      acceleration_0_100: null,
      doors: null,
      drivetrain: null,
      origin_country: null,
      about: null,
      about_ar: null,
    })
  })

  it('updates an existing vehicle (Edit Vehicle)', async () => {
    fromMock.mockReturnValue(chainable({ data: null, error: null }))
    await expect(
      updateVehicle('v1', { ...EMPTY_VEHICLE_DRAFT, categoryId: 'cat-1', make: 'Nissan', model: 'Altima', plateNumber: 'B99999' }),
    ).resolves.toBeUndefined()
  })

  it('changes a vehicle status independently of a full edit (e.g. sending a vehicle to maintenance)', async () => {
    fromMock.mockReturnValue(chainable({ data: null, error: null }))
    await expect(updateVehicleStatus('v1', 'maintenance')).resolves.toBeUndefined()
    expect(fromMock).toHaveBeenCalledWith('vehicles')
  })

  it('deletes a vehicle and its photos from storage (Delete Vehicle)', async () => {
    fromMock.mockReturnValue(chainable({ data: null, error: null }))
    await expect(deleteVehicle('v1', ['v1/photo-a.jpg', 'v1/photo-b.jpg'])).resolves.toBeUndefined()
    expect(storageRemoveMock).toHaveBeenCalledWith(['v1/photo-a.jpg', 'v1/photo-b.jpg'])
    expect(fromMock).toHaveBeenCalledWith('vehicles')
  })

  it('skips the storage call when the vehicle has no photos', async () => {
    fromMock.mockReturnValue(chainable({ data: null, error: null }))
    await expect(deleteVehicle('v1', [])).resolves.toBeUndefined()
    expect(storageRemoveMock).not.toHaveBeenCalled()
  })

  it('surfaces a delete failure (e.g. the vehicle still has booking history) as AdminApiError', async () => {
    fromMock.mockReturnValue(
      chainable({ data: null, error: { message: 'update or delete on table "vehicles" violates foreign key constraint' } }),
    )
    await expect(deleteVehicle('v1', [])).rejects.toThrow('violates foreign key constraint')
  })

  it('surfaces a database error as AdminApiError', async () => {
    fromMock.mockReturnValue(chainable({ data: null, error: { message: 'plate_number must be unique' } }))
    await expect(
      createVehicle({ ...EMPTY_VEHICLE_DRAFT, categoryId: 'cat-1', make: 'Nissan', model: 'Altima', plateNumber: 'B99999' }),
    ).rejects.toThrow('plate_number must be unique')
  })
})
