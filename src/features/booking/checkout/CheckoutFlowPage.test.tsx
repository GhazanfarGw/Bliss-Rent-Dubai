import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { CheckoutFlowPage } from './CheckoutFlowPage'
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

function seedCustomerDraft(customer: { firstName: string; lastName: string; phone: string; email?: string }) {
  sessionStorage.setItem(
    'dxb-checkout:veh-1',
    JSON.stringify({
      vehicleId: 'veh-1',
      criteria,
      customer: { email: 'jane@example.com', ...customer },
      driver: { isSameAsCustomer: true, firstName: '', lastName: '', phone: '', licenseNumber: '', licenseCountry: '', licenseExpiry: '' },
    }),
  )
}

function renderCheckout(step: 'customer' | 'driver' | 'summary' = 'customer') {
  return render(
    <MemoryRouter initialEntries={[`/checkout/veh-1/${step}?${qs}`]}>
      <Routes>
        <Route path="/checkout/:id/:step" element={<CheckoutFlowPage />} />
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

describe('CheckoutFlowPage — one continuous flow (Customer → Driver → Review)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.mocked(fetchVehicleById).mockResolvedValue(vehicle)
    vi.mocked(fetchLocations).mockResolvedValue([pickupLocation])
    vi.mocked(createBooking).mockReset()
  })

  describe('Customer step', () => {
    it('renders exactly the four fields the brief specifies — First name, Last name, Email, Phone', async () => {
      renderCheckout('customer')
      await screen.findByRole('textbox', { name: /first name/i })
      expect(screen.getByRole('textbox', { name: /last name/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /^email/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /phone/i })).toBeInTheDocument()
    })

    it('blocks Continue and shows field errors on an empty submit', async () => {
      renderCheckout('customer')
      fireEvent.click(await screen.findByRole('button', { name: /continue to driver details/i }))

      expect(await screen.findByText(/please enter the customer's first name/i)).toBeInTheDocument()
      expect(screen.queryByText(/who will drive the car/i)).not.toBeInTheDocument()
    })

    it('advances to the Driver step in place once all four fields are valid, without a full page remount', async () => {
      renderCheckout('customer')
      fireEvent.change(await screen.findByRole('textbox', { name: /first name/i }), { target: { value: 'Jane' } })
      fireEvent.change(screen.getByRole('textbox', { name: /last name/i }), { target: { value: 'Renter' } })
      fireEvent.change(screen.getByRole('textbox', { name: /^email/i }), { target: { value: 'jane@example.com' } })
      fireEvent.change(screen.getByRole('textbox', { name: /phone/i }), { target: { value: '+971501234567' } })

      fireEvent.click(screen.getByRole('button', { name: /continue to driver details/i }))

      await screen.findByText(/who will drive the car/i)
      // The just-completed step collapses into an editable recap instead of disappearing.
      expect(screen.getByText(/jane renter.*jane@example\.com.*\+971501234567/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument()
    })
  })

  describe('Driver step', () => {
    it('defaults to "I am the driver" and shows the customer\'s own name/phone from Step 1 read-only, without asking to retype it', async () => {
      seedCustomerDraft({ firstName: 'Jane', lastName: 'Renter', phone: '+971501234567' })
      renderCheckout('driver')

      expect((await screen.findAllByText(/Jane Renter/)).length).toBeGreaterThan(0)
      expect(screen.queryByRole('textbox', { name: /driver's first name/i })).not.toBeInTheDocument()
    })

    it('switching to "Someone else will drive" reveals First/Last/Phone fields for that person', async () => {
      seedCustomerDraft({ firstName: 'Jane', lastName: 'Renter', phone: '+971501234567' })
      renderCheckout('driver')

      fireEvent.click(await screen.findByRole('button', { name: /someone else will drive/i }))

      expect(screen.getByRole('textbox', { name: /driver's first name/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /driver's last name/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /driver phone number/i })).toBeInTheDocument()
    })

    it('blocks Continue until the license fields are filled in, even in "I am the driver" mode', async () => {
      seedCustomerDraft({ firstName: 'Jane', lastName: 'Renter', phone: '+971501234567' })
      renderCheckout('driver')

      fireEvent.click(await screen.findByRole('button', { name: /continue to booking summary/i }))

      expect(await screen.findByText(/please enter a valid driving license number/i)).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Pricing' })).not.toBeInTheDocument()
    })

    it('advances to Review once the license fields are valid', async () => {
      seedCustomerDraft({ firstName: 'Jane', lastName: 'Renter', phone: '+971501234567' })
      renderCheckout('driver')

      fireEvent.change(await screen.findByRole('textbox', { name: /license number/i }), { target: { value: 'DL123456' } })
      fireEvent.change(screen.getByRole('textbox', { name: /issuing country/i }), { target: { value: 'United Arab Emirates' } })
      fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2030-01-01' } })

      fireEvent.click(screen.getByRole('button', { name: /continue to booking summary/i }))

      await screen.findByRole('heading', { name: 'Pricing' })
    })

    it('going Back to the Customer step keeps the previously entered details, with nothing to retype', async () => {
      seedCustomerDraft({ firstName: 'Jane', lastName: 'Renter', phone: '+971501234567' })
      renderCheckout('driver')
      await screen.findByRole('button', { name: /continue to booking summary/i })

      fireEvent.click(screen.getByRole('link', { name: /back/i }))

      expect(await screen.findByRole('textbox', { name: /first name/i })).toHaveValue('Jane')
      expect(screen.getByRole('textbox', { name: /last name/i })).toHaveValue('Renter')
      expect(screen.getByRole('textbox', { name: /phone/i })).toHaveValue('+971501234567')
    })
  })

  describe('Review step', () => {
    beforeEach(() => {
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
    })

    it('shows the full booking details with an Edit link on each completed section', async () => {
      renderCheckout('summary')

      await screen.findByRole('button', { name: /confirm & continue to payment/i })
      for (const heading of ['Vehicle', 'Customer', 'Driver', 'Pricing']) {
        expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
      }
      expect(screen.getByText('MG 5 (2024)')).toBeInTheDocument()
      expect(screen.getAllByRole('link', { name: /edit/i }).length).toBeGreaterThanOrEqual(2)
    })

    it('calls create-booking on first Confirm when there is no existing pending booking', async () => {
      vi.mocked(createBooking).mockResolvedValue(creationResult)
      renderCheckout('summary')

      fireEvent.click(await screen.findByRole('button', { name: /confirm & continue to payment/i }))

      await waitFor(() => expect(createBooking).toHaveBeenCalledTimes(1))
      await screen.findByText('PAYMENT PAGE')
      expect(readActiveBooking('veh-1', criteria)?.bookingReference).toBe('BLS-NEW00001')
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

      renderCheckout('summary')

      await screen.findByText(/you already have a booking in progress/i)
      expect(screen.getByText('BLS-E16F5DC3')).toBeInTheDocument()
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

      renderCheckout('summary')

      await screen.findByText(/you already have a booking in progress/i)
      fireEvent.click(screen.getByRole('button', { name: /start a new booking/i }))

      const confirmButton = await screen.findByRole('button', { name: /confirm & continue to payment/i })
      fireEvent.click(confirmButton)
      await waitFor(() => expect(createBooking).toHaveBeenCalledTimes(1))
    })

    it('an incomplete draft sends the customer back to whichever step is missing instead of attempting to confirm', async () => {
      sessionStorage.setItem(
        'dxb-checkout:veh-1',
        JSON.stringify({
          vehicleId: 'veh-1',
          criteria,
          customer: { firstName: '', lastName: '', email: '', phone: '' },
          driver: { isSameAsCustomer: true, firstName: '', lastName: '', phone: '', licenseNumber: '', licenseCountry: '', licenseExpiry: '' },
        }),
      )
      renderCheckout('summary')

      expect(await screen.findByText(/please complete your customer details/i)).toBeInTheDocument()
      expect(createBooking).not.toHaveBeenCalled()
    })
  })

  it('an unknown step segment redirects to the Customer step', async () => {
    render(
      <MemoryRouter initialEntries={[`/checkout/veh-1/bogus?${qs}`]}>
        <Routes>
          <Route path="/checkout/:id/:step" element={<CheckoutFlowPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('textbox', { name: /first name/i })
  })
})
