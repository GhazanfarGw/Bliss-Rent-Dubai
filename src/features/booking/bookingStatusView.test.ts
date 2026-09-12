import { describe, it, expect } from 'vitest'
import { toBookingStatusSummary } from '@/features/booking/bookingStatusView'
import type { BookingLookupResult } from '@/types/domain'

const FIXED_TODAY = new Date('2026-09-10T12:00:00')

const baseResult: BookingLookupResult = {
  bookingId: 'bk-1',
  bookingReference: 'BLS-ABCDEF12',
  bookingStatus: 'confirmed',
  startDate: '2026-09-08',
  endDate: '2026-09-15',
  totalPrice: 900,
  currency: 'AED',
  vehicleId: 'veh-1',
  vehicleMake: 'Toyota',
  vehicleModel: 'Camry',
  vehiclePlate: 'ABC-123',
  pickupLocationId: 'loc-1',
  dropoffLocationId: 'loc-1',
  pickupLocationName: 'DXB Terminal 3',
  dropoffLocationName: 'DXB Terminal 3',
  customerName: 'Jane Renter',
  paymentId: 'pay-1',
  paymentStatus: 'paid',
  createdAt: '2026-08-20T10:00:00Z',
}

describe('toBookingStatusSummary', () => {
  it('reduces the full lookup result to exactly the four required fields', () => {
    expect(toBookingStatusSummary(baseResult, FIXED_TODAY)).toEqual({
      clientName: 'Jane Renter',
      carName: 'Toyota Camry',
      carNumber: 'ABC-123',
      daysLeft: 5,
    })
  })

  it('never invents or leaks payment/pricing fields onto the summary', () => {
    const summary = toBookingStatusSummary(baseResult, FIXED_TODAY)
    expect(summary).not.toHaveProperty('totalPrice')
    expect(summary).not.toHaveProperty('paymentStatus')
    expect(summary).not.toHaveProperty('pickupLocationName')
  })

  it('clamps days left to 0 for an already-ended rental', () => {
    const ended = { ...baseResult, endDate: '2026-09-01' }
    expect(toBookingStatusSummary(ended, FIXED_TODAY).daysLeft).toBe(0)
  })
})
