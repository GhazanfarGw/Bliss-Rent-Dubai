import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveBookingResult,
  readBookingResult,
  saveConfirmationSnapshot,
  readConfirmationSnapshot,
  saveActiveBooking,
  readActiveBooking,
  clearActiveBooking,
  readPendingBookingIndicator,
  resumePendingBookingFromLookup,
  PENDING_BOOKING_EVENT,
  type ActiveBookingPointer,
} from './checkoutStorage'
import type { BookingConfirmationSnapshot, BookingCreationResult, BookingLookupResult } from '@/types/domain'

const bookingResult: BookingCreationResult = {
  bookingId: 'bk-1',
  bookingReference: 'BLS-ABCDEF12',
  customerId: 'cust-1',
  driverId: 'drv-1',
  paymentId: 'pay-1',
  status: 'pending_payment',
  term: 'daily',
  unitPrice: 150,
  totalPrice: 900,
  currency: 'AED',
  days: 6,
}

const confirmationSnapshot: BookingConfirmationSnapshot = {
  bookingReference: 'BLS-ABCDEF12',
  bookingId: 'bk-1',
  vehicleMake: 'Toyota',
  vehicleModel: 'Camry',
  startDate: '2026-09-10',
  endDate: '2026-09-15',
  pickupLocationName: 'DXB Terminal 3',
  dropoffLocationName: 'Downtown Dubai',
  customerName: 'Jane Renter',
  driverName: 'John Driver',
  totalPrice: 900,
  currency: 'AED',
  paymentStatus: 'paid',
  bookingStatus: 'confirmed',
}

describe('checkoutStorage', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('round-trips a booking creation result by booking id', () => {
    saveBookingResult(bookingResult)
    expect(readBookingResult('bk-1')).toEqual(bookingResult)
  })

  it('returns null for a booking id that was never saved', () => {
    expect(readBookingResult('does-not-exist')).toBeNull()
  })

  it('round-trips a confirmation snapshot by booking id', () => {
    saveConfirmationSnapshot(confirmationSnapshot)
    expect(readConfirmationSnapshot('bk-1')).toEqual(confirmationSnapshot)
  })

  it('returns null for a confirmation that was never saved', () => {
    expect(readConfirmationSnapshot('does-not-exist')).toBeNull()
  })

  it('does not throw and returns null when stored JSON is corrupted', () => {
    sessionStorage.setItem('dxb-booking-result:bk-2', '{not valid json')
    expect(readBookingResult('bk-2')).toBeNull()
  })

  it('keeps booking results and confirmation snapshots for different booking ids independent', () => {
    saveBookingResult(bookingResult)
    saveBookingResult({ ...bookingResult, bookingId: 'bk-2', bookingReference: 'BLS-22222222' })
    expect(readBookingResult('bk-1')?.bookingReference).toBe('BLS-ABCDEF12')
    expect(readBookingResult('bk-2')?.bookingReference).toBe('BLS-22222222')
  })
})

// ---------------------------------------------------------------------------
// Checkout / Payment Flow Recovery — regression coverage for the resume
// logic that fixes the "Payment → Back → Summary → Confirm again" bug
// (see this file's own module comment for the full root-cause writeup).
// ---------------------------------------------------------------------------

const criteria = {
  startDate: '2026-10-01',
  endDate: '2026-10-09',
  pickupLocationId: 'loc-pickup-1',
  dropoffLocationId: 'loc-dropoff-1',
}

const pointer: ActiveBookingPointer = {
  vehicleId: 'veh-1',
  vehicleMake: 'MG',
  vehicleModel: '5',
  startDate: criteria.startDate,
  endDate: criteria.endDate,
  pickupLocationId: criteria.pickupLocationId,
  dropoffLocationId: criteria.dropoffLocationId,
  pickupLocationName: 'Sharjah City Centre',
  dropoffLocationName: 'Sharjah City Centre',
  bookingId: 'bk-e16f5dc3',
  bookingReference: 'BLS-E16F5DC3',
  paymentId: 'pay-e16f5dc3',
  totalPrice: 952,
  currency: 'AED',
}

describe('checkoutStorage — active booking resume (root-cause fix)', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('resumes the same booking when the vehicle and dates/locations match exactly', () => {
    saveActiveBooking(pointer)
    expect(readActiveBooking('veh-1', criteria)).toEqual(pointer)
  })

  it('does NOT resume when the customer changed dates — a genuinely new booking must be allowed', () => {
    saveActiveBooking(pointer)
    expect(readActiveBooking('veh-1', { ...criteria, endDate: '2026-10-12' })).toBeNull()
  })

  it('does NOT resume when the customer changed pickup/dropoff location', () => {
    saveActiveBooking(pointer)
    expect(readActiveBooking('veh-1', { ...criteria, pickupLocationId: 'loc-pickup-2' })).toBeNull()
  })

  it('does not leak a resume across different vehicles', () => {
    saveActiveBooking(pointer)
    expect(readActiveBooking('veh-2', criteria)).toBeNull()
  })

  it('returns null when nothing was ever saved for this vehicle', () => {
    expect(readActiveBooking('veh-never-booked', criteria)).toBeNull()
  })

  it('clearActiveBooking removes the resume pointer for that vehicle only', () => {
    saveActiveBooking(pointer)
    saveActiveBooking({ ...pointer, vehicleId: 'veh-2', bookingId: 'bk-2', bookingReference: 'BLS-22222222' })
    clearActiveBooking('veh-1')
    expect(readActiveBooking('veh-1', criteria)).toBeNull()
    expect(readActiveBooking('veh-2', criteria)?.bookingId).toBe('bk-2')
  })

  it('does not throw and returns null when the stored pointer is corrupted', () => {
    sessionStorage.setItem('dxb-active-booking:veh-1', '{not valid json')
    expect(readActiveBooking('veh-1', criteria)).toBeNull()
  })
})

describe('checkoutStorage — header pending-booking indicator', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('is empty until a booking is saved', () => {
    expect(readPendingBookingIndicator()).toBeNull()
  })

  it('reflects the most recently saved active booking', () => {
    saveActiveBooking(pointer)
    expect(readPendingBookingIndicator()).toEqual(pointer)
    const second = { ...pointer, vehicleId: 'veh-2', bookingId: 'bk-2', bookingReference: 'BLS-22222222' }
    saveActiveBooking(second)
    expect(readPendingBookingIndicator()).toEqual(second)
  })

  it('clears only when the cleared vehicle is the one currently shown', () => {
    saveActiveBooking(pointer)
    const second = { ...pointer, vehicleId: 'veh-2', bookingId: 'bk-2', bookingReference: 'BLS-22222222' }
    saveActiveBooking(second)
    // The indicator now shows veh-2 (most recent) — clearing veh-1 must not touch it.
    clearActiveBooking('veh-1')
    expect(readPendingBookingIndicator()?.vehicleId).toBe('veh-2')
    clearActiveBooking('veh-2')
    expect(readPendingBookingIndicator()).toBeNull()
  })

  it('fires PENDING_BOOKING_EVENT on save and on clear, so the header can re-render in the same tab', () => {
    const handler = vi.fn()
    window.addEventListener(PENDING_BOOKING_EVENT, handler)
    saveActiveBooking(pointer)
    clearActiveBooking('veh-1')
    window.removeEventListener(PENDING_BOOKING_EVENT, handler)
    expect(handler).toHaveBeenCalledTimes(2)
  })
})

describe('checkoutStorage — resumePendingBookingFromLookup (Manage Booking → Continue to Payment)', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  const lookupResult: BookingLookupResult = {
    bookingId: 'bk-e16f5dc3',
    bookingReference: 'BLS-E16F5DC3',
    bookingStatus: 'pending_payment',
    startDate: '2026-10-01',
    endDate: '2026-10-09',
    totalPrice: 952,
    currency: 'AED',
    vehicleId: 'veh-1',
    vehicleMake: 'MG',
    vehicleModel: '5',
    vehiclePlate: 'TEMP-ECO-04',
    pickupLocationId: 'loc-pickup-1',
    dropoffLocationId: 'loc-dropoff-1',
    pickupLocationName: 'Sharjah City Centre',
    dropoffLocationName: 'Sharjah City Centre',
    customerName: 'Ghazanfar Abbas',
    paymentId: 'pay-e16f5dc3',
    paymentStatus: 'pending',
    createdAt: '2026-09-02T13:11:05.850Z',
  }

  it('seeds a bookingResult PaymentPage can read, without ever calling create-booking', () => {
    resumePendingBookingFromLookup(lookupResult)
    const result = readBookingResult('bk-e16f5dc3')
    expect(result?.paymentId).toBe('pay-e16f5dc3')
    expect(result?.bookingReference).toBe('BLS-E16F5DC3')
    expect(result?.totalPrice).toBe(952)
    expect(result?.currency).toBe('AED')
  })

  it('also seeds the active-booking pointer, so the header reminder and BookingSummaryPage resume panel both pick it up', () => {
    resumePendingBookingFromLookup(lookupResult)
    expect(readActiveBooking('veh-1', criteria)?.bookingReference).toBe('BLS-E16F5DC3')
    expect(readPendingBookingIndicator()?.bookingReference).toBe('BLS-E16F5DC3')
  })

  it('pre-fills the customer name (split first/last, best-effort) into the checkout draft, without inventing driver/email/phone data', () => {
    resumePendingBookingFromLookup(lookupResult)
    const draft = JSON.parse(sessionStorage.getItem('dxb-checkout:veh-1') ?? 'null')
    expect(draft.customer.firstName).toBe('Ghazanfar')
    expect(draft.customer.lastName).toBe('Abbas')
    expect(draft.customer.email).toBe('')
    expect(draft.driver.firstName).toBe('')
  })

  it('never overwrites a draft that already exists in this browser', () => {
    sessionStorage.setItem(
      'dxb-checkout:veh-1',
      JSON.stringify({ vehicleId: 'veh-1', criteria, customer: { firstName: 'Existing', lastName: 'Guest', email: 'a@b.com', phone: '' }, driver: { isSameAsCustomer: true, firstName: '', lastName: '', phone: '', licenseNumber: '', licenseCountry: '', licenseExpiry: '' } }),
    )
    resumePendingBookingFromLookup(lookupResult)
    const draft = JSON.parse(sessionStorage.getItem('dxb-checkout:veh-1') ?? 'null')
    expect(draft.customer.firstName).toBe('Existing')
  })
})
