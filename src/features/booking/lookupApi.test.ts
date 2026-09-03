import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpcMock = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

const { lookupBooking, BookingLookupError } = await import('./lookupApi')

const row = {
  booking_id: 'bk-1',
  booking_reference: 'BLS-ABCDEF12',
  booking_status: 'confirmed',
  start_date: '2026-09-10',
  end_date: '2026-09-15',
  total_price: 900,
  currency: 'AED',
  vehicle_id: 'veh-1',
  vehicle_make: 'Toyota',
  vehicle_model: 'Camry',
  vehicle_plate: 'ABC-123',
  pickup_location_id: 'loc-1',
  dropoff_location_id: 'loc-2',
  pickup_location_name: 'DXB Terminal 3',
  dropoff_location_name: 'Downtown Dubai',
  customer_name: 'Jane Renter',
  payment_id: 'pay-1',
  payment_status: 'paid',
  created_at: '2026-08-20T10:00:00Z',
}

const expectedResult = {
  bookingId: 'bk-1',
  bookingReference: 'BLS-ABCDEF12',
  bookingStatus: 'confirmed',
  startDate: '2026-09-10',
  endDate: '2026-09-15',
  totalPrice: 900,
  currency: 'AED',
  vehicleId: 'veh-1',
  vehicleMake: 'Toyota',
  vehicleModel: 'Camry',
  vehiclePlate: 'ABC-123',
  pickupLocationId: 'loc-1',
  dropoffLocationId: 'loc-2',
  pickupLocationName: 'DXB Terminal 3',
  dropoffLocationName: 'Downtown Dubai',
  customerName: 'Jane Renter',
  paymentId: 'pay-1',
  paymentStatus: 'paid',
  createdAt: '2026-08-20T10:00:00Z',
}

describe('lookupBooking', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('calls lookup_booking_for_customer with the trimmed query', async () => {
    rpcMock.mockResolvedValue({ data: [row], error: null })
    await lookupBooking('  BLS-ABCDEF12  ')
    expect(rpcMock).toHaveBeenCalledWith('lookup_booking_for_customer', {
      p_query: 'BLS-ABCDEF12',
    })
  })

  it('maps a match found by booking reference into a BookingLookupResult', async () => {
    rpcMock.mockResolvedValue({ data: [row], error: null })
    const result = await lookupBooking('BLS-ABCDEF12')
    expect(result).toEqual(expectedResult)
  })

  it('maps a match found by vehicle plate alone (no reference typed) the same way', async () => {
    rpcMock.mockResolvedValue({ data: [row], error: null })
    const result = await lookupBooking('ABC-123')
    expect(rpcMock).toHaveBeenCalledWith('lookup_booking_for_customer', { p_query: 'ABC-123' })
    expect(result).toEqual(expectedResult)
  })

  it('returns null (not an error) when the query matches nothing', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    const result = await lookupBooking('BLS-NOTREAL1')
    expect(result).toBeNull()
  })

  it('raises BookingLookupError on a database error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'connection failed' } })
    await expect(lookupBooking('BLS-ABCDEF12')).rejects.toThrow(BookingLookupError)
  })
})
