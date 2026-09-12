import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chainable } from '@/test/supabaseMock'
import { EMPTY_VEHICLE_DRAFT } from '@/types/domain'

const fromMock = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

const { fetchVehicles, createVehicle, updateVehicle, updateVehicleStatus } = await import('./adminFleetApi')

describe('adminFleetApi', () => {
  beforeEach(() => {
    fromMock.mockReset()
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

  it('surfaces a database error as AdminApiError', async () => {
    fromMock.mockReturnValue(chainable({ data: null, error: { message: 'plate_number must be unique' } }))
    await expect(
      createVehicle({ ...EMPTY_VEHICLE_DRAFT, categoryId: 'cat-1', make: 'Nissan', model: 'Altima', plateNumber: 'B99999' }),
    ).rejects.toThrow('plate_number must be unique')
  })
})
