import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { BookingSummaryPage } from './BookingSummaryPage'
import { fetchVehicleById, fetchLocations } from '@/features/booking/api'
import { createBooking } from '@/features/booking/checkout/checkoutApi'
import { saveActiveBooking, readActiveBooking } from '@/features/booking/checkout/checkoutStorage'
import type { VehicleWithDetails, Location, BookingCreationResult } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchVehicleById: vi.fn(),
  fetchLocations: vi.fn(),
}))

vi.mock('@/features/booking/checkout/checkoutApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./checkoutApi')>()
  return { ...actual, createBooking: vi.fn() }
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

function renderSummary() {
  return render(
    <MemoryRouter initialEntries={[`/checkout/veh-1/summary?${qs}`]}>
      <Routes>
        <Route path="/checkout/:id/summary" element={<BookingSummaryPage />} />
        <Route path="/checkout/:id/payment/:bookingId" element={<div>PAYMENT PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const creationResult: BookingCreationResult = {
  bookingId: 'bk-new',
  bookingReference: 'BLS-NEW00001',
  customerId: 'cust-1',
  driverId: 'drv-1',
  paymentId: 'pay-new',
  status: 'pending_payment',
  term: 'daily',
  unitPrice: 100,
  totalPrice: 200,
  currency: 'AED',
  days: 3,
}

describe('BookingSummaryPage — resume vs. re-create (root-cause regression)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem(
      'dxb-checkout:veh-1',
      JSON.stringify({
        vehicleId: 'veh-1',
        criteria,
        customer: { firstName: 'Jane', lastName: 'Renter', email: 'jane@example.com', phone: '+971500000000' },
        driver: {
          isSameAsCustomer: true,
          firstName: '',
          lastName: '',
          phone: '',
          licenseNumber: 'DXB-123456',
          licenseCountry: 'AE',
          licenseExpiry: '2030-01-01',
        },
      }),
    )
    vi.mocked(fetchVehicleById).mockResolvedValue(vehicle)
    vi.mocked(fetchLocations).mockResolvedValue([pickupLocation])
    vi.mocked(createBooking).mockReset()
  })

  it('calls create-booking on first Confirm when there is no existing pending booking', async () => {
    vi.mocked(createBooking).mockResolvedValue(creationResult)
    renderSummary()

    const confirmButton = await screen.findByRole('button', { name: /confirm & continue to payment/i })
    fireEvent.click(confirmButton)

    await waitFor(() => expect(createBooking).toHaveBeenCalledTimes(1))
    await screen.findByText('PAYMENT PAGE')
    expect(readActiveBooking('veh-1', criteria)?.bookingReference).toBe('BLS-NEW00001')
  })

  it('shows the full booking details: vehicle, dates, duration, places, customer, driver and pricing', async () => {
    renderSummary()

    await screen.findByRole('button', { name: /confirm & continue to payment/i })
    for (const heading of ['Vehicle', 'Customer', 'Driver', 'Pricing']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByText('MG 5 (2024)')).toBeInTheDocument()
    expect(screen.getByText('2026-10-01 → 2026-10-03')).toBeInTheDocument()
    expect(screen.getByText('3 days', { selector: 'dd' })).toBeInTheDocument()
    // pickup and drop-off — listed once, in the Vehicle section (the trip card does not repeat them on this step)
    expect(screen.getAllByText('Sharjah City Centre', { selector: 'dd' })).toHaveLength(2)
    expect(screen.queryByText('Pickup date')).not.toBeInTheDocument()
    expect(screen.queryByText('Drop-off date')).not.toBeInTheDocument()
    expect(screen.getAllByText('Jane Renter', { selector: 'dd' })).toHaveLength(2) // customer and (same) driver
    expect(screen.getByText('DXB-123456')).toBeInTheDocument()
    expect(screen.getByText('Not yet paid')).toBeInTheDocument()
  })

  it('resumes an existing pending booking for the same vehicle+dates WITHOUT calling create-booking again', async () => {
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
      bookingId: 'bk-e16f5dc3',
      bookingReference: 'BLS-E16F5DC3',
      paymentId: 'pay-e16f5dc3',
      totalPrice: 952,
      currency: 'AED',
    })

    renderSummary()

    // The resume panel, not the normal create-booking form.
    await screen.findByText(/you already have a booking in progress/i)
    expect(screen.getByText('BLS-E16F5DC3')).toBeInTheDocument()
    // …with the same full summary below it as the normal review, not a shorter one.
    for (const heading of ['Vehicle', 'Customer', 'Driver', 'Pricing']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByText('2026-10-01 → 2026-10-03')).toBeInTheDocument()
    expect(screen.getAllByText('Sharjah City Centre', { selector: 'dd' })).toHaveLength(2)
    expect(screen.getAllByText('Jane Renter', { selector: 'dd' })).toHaveLength(2)
    expect(screen.getByText('952', { selector: 'dd' })).toBeInTheDocument() // the pending booking's amount due
    expect(screen.queryByRole('button', { name: /confirm & continue to payment/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    await screen.findByText('PAYMENT PAGE')
    expect(createBooking).not.toHaveBeenCalled()
  })

  it('"start a new booking" bypasses the resume panel and allows a fresh create-booking call', async () => {
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
      bookingId: 'bk-e16f5dc3',
      bookingReference: 'BLS-E16F5DC3',
      paymentId: 'pay-e16f5dc3',
      totalPrice: 952,
      currency: 'AED',
    })
    vi.mocked(createBooking).mockResolvedValue(creationResult)

    renderSummary()

    await screen.findByText(/you already have a booking in progress/i)
    fireEvent.click(screen.getByRole('button', { name: /start a new booking/i }))

    const confirmButton = await screen.findByRole('button', { name: /confirm & continue to payment/i })
    fireEvent.click(confirmButton)
    await waitFor(() => expect(createBooking).toHaveBeenCalledTimes(1))
  })
})
