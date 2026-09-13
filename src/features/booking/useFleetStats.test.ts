import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFleetStats } from '@/features/booking/useFleetStats'

const fetchAllAvailableVehicles = vi.fn()
const fetchLocations = vi.fn()

vi.mock('@/features/booking/api', () => ({
  fetchAllAvailableVehicles: (...args: unknown[]) => fetchAllAvailableVehicles(...args),
  fetchLocations: (...args: unknown[]) => fetchLocations(...args),
}))

describe('useFleetStats', () => {
  beforeEach(() => {
    fetchAllAvailableVehicles.mockReset().mockResolvedValue([])
    fetchLocations.mockReset().mockResolvedValue([])
  })

  it('starts as null and never shows a fake/placeholder number before the fetch resolves', () => {
    const { result } = renderHook(() => useFleetStats())
    expect(result.current).toBeNull()
  })

  it('derives real vehicle/category/city counts from the live fleet + locations queries', async () => {
    fetchAllAvailableVehicles.mockResolvedValue([
      { id: '1', vehicle_categories: { name: 'Economy' } },
      { id: '2', vehicle_categories: { name: 'Economy' } },
      { id: '3', vehicle_categories: { name: 'Luxury' } },
    ])
    fetchLocations.mockResolvedValue([{ city: 'Dubai' }, { city: 'Dubai' }, { city: 'Abu Dhabi' }])

    const { result } = renderHook(() => useFleetStats())

    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current).toEqual({
      vehicleCount: 3,
      categoryNames: ['Economy', 'Luxury'],
      categoryCount: 2,
      cityNames: ['Abu Dhabi', 'Dubai'],
      cityCount: 2,
    })
  })

  it('stays null on failure — no fake fallback', async () => {
    fetchAllAvailableVehicles.mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useFleetStats())

    await waitFor(() => expect(fetchAllAvailableVehicles).toHaveBeenCalled())
    expect(result.current).toBeNull()
  })
})
