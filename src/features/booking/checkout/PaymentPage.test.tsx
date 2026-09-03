import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PaymentPage } from './PaymentPage'
import { fetchVehicleById, fetchLocations } from '@/features/booking/api'
import { confirmPayment } from '@/features/booking/checkout/checkoutApi'
import { saveBookingResult, saveActiveBooking, readActiveBooking } from '@/features/booking/checkout/checkoutStorage'
import type { VehicleWithDetails, Location, BookingCreationResult } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchVehicleById: vi.fn(),
  fetchLocations: vi.fn(),
}))

vi.mock('@/features/booking/checkout/checkoutApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./checkoutApi')>()
  return { ...actual, confirmPayment: vi.fn() }
})

const vehicle: VehicleWithDetails = {
  id: 'veh-1',
  category_id: 'cat-eco',
  make: 'MG',
  model: '5',
  model_year: 2024,
  transmission: 'automatic',
  seats: 5,
  plate_number: 'TEMP-ECO-04',
  status: 'available',
  created_at: '2026-01-01T00:00:00Z',
  vehicle_categories: { id: 'cat-eco', name: 'Economy', description: null },
  vehicle_images: [],
  pricing: [{ id: 'p1', vehicle_id: 'veh-1', term: 'daily', list_price: 100, client_price: 100, currency: 'AED' }],
} as unknown as VehicleWithDetails

const pickupLocation: Location = { id: 'loc-1', name: 'Sharjah City Centre', is_active: true } as unknown as Location

const criteria = { startDate: '2026-10-01', endDate: '2026-10-03', pickupLocationId: 'loc-1', dropoffLocationId: 'loc-1' }
const qs = `start=${criteria.startDate}&end=${criteria.endDate}&pickup=loc-1&dropoff=loc-1`

const bookingResult: BookingCreationResult = {
  bookingId: 'bk-1',
  bookingReference: 'BLS-E16F5DC3',
  customerId: 'cust-1',
  driverId: 'drv-1',
  paymentId: 'pay-1',
  status: 'pending_payment',
  term: 'daily',
  unitPrice: 100,
  totalPrice: 200,
  currency: 'AED',
  days: 2,
}

function renderPayment(bookingId = 'bk-1') {
  return render(
    <MemoryRouter initialEntries={[`/checkout/veh-1/payment/${bookingId}?${qs}`]}>
      <Routes>
        <Route path="/checkout/:id/payment/:bookingId" element={<PaymentPage />} />
        <Route path="/checkout/:id/confirmation/:bookingId" element={<div>CONFIRMATION PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PaymentPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.mocked(fetchVehicleById).mockResolvedValue(vehicle)
    vi.mocked(fetchLocations).mockResolvedValue([pickupLocation])
    vi.mocked(confirmPayment).mockReset()
  })

  it('shows a not-found state, not fake data, when no booking result exists for this browser', async () => {
    renderPayment('bk-does-not-exist')
    expect(await screen.findByText(/we can't find that booking in this browser/i)).toBeInTheDocument()
  })

  it('on success, clears the active-booking resume pointer and navigates to confirmation', async () => {
    saveBookingResult(bookingResult)
    saveActiveBooking({
      vehicleId: 'veh-1',
      vehicleMake: 'MG',
      vehicleModel: '5',
      startDate: criteria.startDate,
      endDate: criteria.endDate,
      pickupLocationId: criteria.pickupLocationId,
      dropoffLocationId: criteria.dropoffLocationId,
      pickupLocationName: 'Sharjah City Centre',
      dropoffLocationName: 'Sharjah City Centre',
      bookingId: 'bk-1',
      bookingReference: 'BLS-E16F5DC3',
      paymentId: 'pay-1',
      totalPrice: 200,
      currency: 'AED',
    })
    vi.mocked(confirmPayment).mockResolvedValue({ paymentId: 'pay-1', bookingId: 'bk-1', paymentStatus: 'paid', bookingStatus: 'confirmed' })

    renderPayment()
    fireEvent.click(await screen.findByRole('button', { name: /^pay/i }))

    await screen.findByText('CONFIRMATION PAGE')
    expect(readActiveBooking('veh-1', criteria)).toBeNull()
  })

  it('on a declined payment, shows a Payment Failed panel with Try Again / Back to Booking — and keeps the resume pointer intact', async () => {
    saveBookingResult(bookingResult)
    saveActiveBooking({
      vehicleId: 'veh-1',
      vehicleMake: 'MG',
      vehicleModel: '5',
      startDate: criteria.startDate,
      endDate: criteria.endDate,
      pickupLocationId: criteria.pickupLocationId,
      dropoffLocationId: criteria.dropoffLocationId,
      pickupLocationName: 'Sharjah City Centre',
      dropoffLocationName: 'Sharjah City Centre',
      bookingId: 'bk-1',
      bookingReference: 'BLS-E16F5DC3',
      paymentId: 'pay-1',
      totalPrice: 200,
      currency: 'AED',
    })
    vi.mocked(confirmPayment).mockResolvedValue({ paymentId: 'pay-1', bookingId: 'bk-1', paymentStatus: 'failed', bookingStatus: 'pending_payment' })

    renderPayment()
    fireEvent.click(await screen.findByRole('button', { name: /^pay/i }))

    expect(await screen.findByText('Payment Failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try payment again/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to booking/i })).toBeInTheDocument()
    // The booking is still pending — the resume pointer must not have been cleared by a failed attempt.
    expect(readActiveBooking('veh-1', criteria)?.bookingReference).toBe('BLS-E16F5DC3')
  })

  it('retry after a decline resubmits the SAME payment id (idempotent — never a new booking)', async () => {
    saveBookingResult(bookingResult)
    vi.mocked(confirmPayment).mockResolvedValueOnce({ paymentId: 'pay-1', bookingId: 'bk-1', paymentStatus: 'failed', bookingStatus: 'pending_payment' })
    vi.mocked(confirmPayment).mockResolvedValueOnce({ paymentId: 'pay-1', bookingId: 'bk-1', paymentStatus: 'paid', bookingStatus: 'confirmed' })

    renderPayment()
    fireEvent.click(await screen.findByRole('button', { name: /^pay/i }))
    fireEvent.click(await screen.findByRole('button', { name: /try payment again/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^pay/i }))

    await screen.findByText('CONFIRMATION PAGE')
    expect(confirmPayment).toHaveBeenCalledTimes(2)
    expect(vi.mocked(confirmPayment).mock.calls[0][0].paymentId).toBe('pay-1')
    expect(vi.mocked(confirmPayment).mock.calls[1][0].paymentId).toBe('pay-1')
  })
})
