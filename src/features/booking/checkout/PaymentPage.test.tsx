import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PaymentPage } from './PaymentPage'
import { fetchVehicleById, fetchLocations } from '@/features/booking/api'
import { createPaymentIntent, confirmStripePayment } from '@/features/booking/checkout/checkoutApi'
import { saveBookingResult, saveActiveBooking, readActiveBooking } from '@/features/booking/checkout/checkoutStorage'
import type { VehicleWithDetails, Location, BookingCreationResult } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchVehicleById: vi.fn(),
  fetchLocations: vi.fn(),
}))

vi.mock('@/features/booking/checkout/checkoutApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./checkoutApi')>()
  return { ...actual, createPaymentIntent: vi.fn(), confirmStripePayment: vi.fn() }
})

// Stripe Elements mounts real iframes via Stripe.js — not something jsdom
// can render. Every test here mocks @stripe/react-stripe-js at the
// module level instead, standing in a fake `useStripe().confirmPayment`
// so the page's OWN logic (loading state, error handling, calling
// confirmStripePayment, navigating on success) is what's under test —
// never Stripe's own SDK internals.
const stripeConfirmPaymentMock = vi.fn()
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: stripeConfirmPaymentMock }),
  useElements: () => ({}),
}))

vi.mock('@/lib/stripeClient', () => ({ getStripe: () => Promise.resolve(null) }))

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

function seedActiveBooking() {
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
}

describe('PaymentPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.mocked(fetchVehicleById).mockResolvedValue(vehicle)
    vi.mocked(fetchLocations).mockResolvedValue([pickupLocation])
    vi.mocked(createPaymentIntent).mockReset()
    vi.mocked(confirmStripePayment).mockReset()
    stripeConfirmPaymentMock.mockReset()
  })

  it('shows a not-found state, not fake data, when no booking result exists for this browser', async () => {
    renderPayment('bk-does-not-exist')
    expect(await screen.findByText(/we can't find that booking in this browser/i)).toBeInTheDocument()
  })

  it('keeps the dates and places in the car card on the payment step — nothing else there lists them', async () => {
    saveBookingResult(bookingResult)
    vi.mocked(createPaymentIntent).mockResolvedValue({ clientSecret: 'pi_1_secret', paymentIntentId: 'pi_1' })

    renderPayment()
    await screen.findByTestId('payment-element')

    expect(screen.getByText('Pickup date')).toBeInTheDocument()
    expect(screen.getByText('Drop-off date')).toBeInTheDocument()
  })

  it('creates a Stripe PaymentIntent on mount and mounts the Payment Element once ready', async () => {
    saveBookingResult(bookingResult)
    vi.mocked(createPaymentIntent).mockResolvedValue({ clientSecret: 'pi_1_secret', paymentIntentId: 'pi_1' })

    renderPayment()

    expect(await screen.findByTestId('payment-element')).toBeInTheDocument()
    expect(createPaymentIntent).toHaveBeenCalledWith({ paymentId: 'pay-1' })
  })

  it('on success (no redirect needed), verifies with our server and navigates to confirmation, clearing the resume pointer', async () => {
    saveBookingResult(bookingResult)
    seedActiveBooking()
    vi.mocked(createPaymentIntent).mockResolvedValue({ clientSecret: 'pi_1_secret', paymentIntentId: 'pi_1' })
    stripeConfirmPaymentMock.mockResolvedValue({ paymentIntent: { id: 'pi_1', status: 'succeeded' } })
    vi.mocked(confirmStripePayment).mockResolvedValue({ paymentId: 'pay-1', bookingId: 'bk-1', paymentStatus: 'paid', bookingStatus: 'confirmed' })

    renderPayment()
    fireEvent.click(await screen.findByRole('button', { name: /^pay/i }))

    await screen.findByText('CONFIRMATION PAGE')
    expect(confirmStripePayment).toHaveBeenCalledWith({ paymentId: 'pay-1', paymentIntentId: 'pi_1' })
    expect(readActiveBooking('veh-1', criteria)).toBeNull()
  })

  it('shows an inline error and keeps the resume pointer intact when Stripe reports a declined card', async () => {
    saveBookingResult(bookingResult)
    seedActiveBooking()
    vi.mocked(createPaymentIntent).mockResolvedValue({ clientSecret: 'pi_1_secret', paymentIntentId: 'pi_1' })
    stripeConfirmPaymentMock.mockResolvedValue({ error: { message: 'Your card was declined.' } })

    renderPayment()
    fireEvent.click(await screen.findByRole('button', { name: /^pay/i }))

    expect(await screen.findByText('Your card was declined.')).toBeInTheDocument()
    expect(confirmStripePayment).not.toHaveBeenCalled()
    // The booking is still pending — a declined attempt must never clear the resume pointer or mark anything failed server-side.
    expect(readActiveBooking('veh-1', criteria)?.bookingReference).toBe('BLS-E16F5DC3')
  })

  it('retrying after a decline can still succeed on the SAME PaymentIntent (never creates a second one)', async () => {
    saveBookingResult(bookingResult)
    vi.mocked(createPaymentIntent).mockResolvedValue({ clientSecret: 'pi_1_secret', paymentIntentId: 'pi_1' })
    stripeConfirmPaymentMock.mockResolvedValueOnce({ error: { message: 'Your card was declined.' } })
    stripeConfirmPaymentMock.mockResolvedValueOnce({ paymentIntent: { id: 'pi_1', status: 'succeeded' } })
    vi.mocked(confirmStripePayment).mockResolvedValue({ paymentId: 'pay-1', bookingId: 'bk-1', paymentStatus: 'paid', bookingStatus: 'confirmed' })

    renderPayment()
    fireEvent.click(await screen.findByRole('button', { name: /^pay/i }))
    await screen.findByText('Your card was declined.')
    fireEvent.click(await screen.findByRole('button', { name: /^pay/i }))

    await screen.findByText('CONFIRMATION PAGE')
    expect(createPaymentIntent).toHaveBeenCalledTimes(1)
    expect(stripeConfirmPaymentMock).toHaveBeenCalledTimes(2)
  })
})
