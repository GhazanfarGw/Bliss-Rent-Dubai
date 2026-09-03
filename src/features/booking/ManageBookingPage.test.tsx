import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ManageBookingPage } from './ManageBookingPage'
import { BookingLookupError } from './lookupApi'
import { readActiveBooking, readBookingResult } from './checkout/checkoutStorage'

const lookupMock = vi.fn()
const submitExtendMock = vi.fn()

vi.mock('./lookupApi', async () => {
  const actual = await vi.importActual<typeof import('./lookupApi')>('./lookupApi')
  return {
    ...actual,
    lookupBooking: (...args: unknown[]) => lookupMock(...args),
  }
})

vi.mock('./extendRentalApi', async () => {
  const actual = await vi.importActual<typeof import('./extendRentalApi')>('./extendRentalApi')
  return {
    ...actual,
    submitExtendRentalRequest: (...args: unknown[]) => submitExtendMock(...args),
  }
})

const confirmedResult = {
  bookingId: 'bk-1',
  bookingReference: 'BLS-ABCDEF12',
  bookingStatus: 'confirmed',
  startDate: '2026-09-10',
  endDate: '2026-09-15',
  totalPrice: 900,
  currency: 'AED',
  vehicleMake: 'Toyota',
  vehicleModel: 'Camry',
  vehiclePlate: 'ABC-123',
  pickupLocationName: 'DXB Terminal 3',
  dropoffLocationName: 'Downtown Dubai',
  customerName: 'Jane Renter',
  paymentStatus: 'paid',
  createdAt: '2026-08-20T10:00:00Z',
}

const completedResult = {
  ...confirmedResult,
  bookingId: 'bk-2',
  bookingReference: 'BLS-99887766',
  bookingStatus: 'completed',
}

const pendingPaymentResult = {
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
  pickupLocationId: 'loc-1',
  dropoffLocationId: 'loc-1',
  pickupLocationName: 'Sharjah City Centre',
  dropoffLocationName: 'Sharjah City Centre',
  customerName: 'Ghazanfar Abbas',
  paymentId: 'pay-e16f5dc3',
  paymentStatus: 'pending',
  createdAt: '2026-09-02T13:11:05.850Z',
}

function renderPage(initialEntries: string[] = ['/manage-booking']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ManageBookingPage />
    </MemoryRouter>,
  )
}

function renderPageWithCheckoutRoutes(initialEntries: string[] = ['/manage-booking']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/manage-booking" element={<ManageBookingPage />} />
        <Route path="/checkout/:id/payment/:bookingId" element={<div>PAYMENT PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// Matches manageBooking.submit — updated to the current copy ("Find my
// car") by the concurrent Phase 8 frontend redesign; this file's other
// pre-existing tests were failing purely on that copy change, unrelated
// to anything in Phase 9D. See the Phase 9D completion report.
function fillAndSubmit(query: string) {
  fireEvent.change(screen.getByPlaceholderText('BLS-XXXXXXXX or ABC-123'), { target: { value: query } })
  fireEvent.click(screen.getByRole('button', { name: /find my car/i }))
}

describe('ManageBookingPage', () => {
  beforeEach(() => {
    lookupMock.mockReset()
    submitExtendMock.mockReset()
    sessionStorage.clear()
  })

  it('shows the booking summary when found by booking reference', async () => {
    lookupMock.mockResolvedValue(confirmedResult)
    renderPage()
    fillAndSubmit('BLS-ABCDEF12')

    await waitFor(() => expect(screen.getByText('BLS-ABCDEF12')).toBeInTheDocument())
    expect(screen.getByText('Toyota Camry')).toBeInTheDocument()
    expect(screen.getByText('Jane Renter')).toBeInTheDocument()
    expect(screen.getByText('ABC-123')).toBeInTheDocument()
    expect(lookupMock).toHaveBeenCalledWith('BLS-ABCDEF12')
  })

  it('shows the booking summary when found by vehicle plate alone', async () => {
    lookupMock.mockResolvedValue(confirmedResult)
    renderPage()
    fillAndSubmit('ABC-123')

    await waitFor(() => expect(screen.getByText('BLS-ABCDEF12')).toBeInTheDocument())
    expect(lookupMock).toHaveBeenCalledWith('ABC-123')
  })

  it('shows a generic not-found message, never fake data, when nothing matches', async () => {
    lookupMock.mockResolvedValue(null)
    renderPage()
    fillAndSubmit('BLS-NOTREAL1')

    await waitFor(() => expect(screen.getByText(/couldn't find a booking/i)).toBeInTheDocument())
    expect(screen.queryByText('BLS-NOTREAL1')).not.toBeInTheDocument()
  })

  it('shows the BookingLookupError message directly when the lookup itself fails', async () => {
    lookupMock.mockRejectedValue(new BookingLookupError('connection failed'))
    renderPage()
    fillAndSubmit('BLS-ABCDEF12')

    await waitFor(() => expect(screen.getByText('connection failed')).toBeInTheDocument())
  })

  it('shows a generic error message for an unexpected (non-BookingLookupError) failure', async () => {
    lookupMock.mockRejectedValue(new Error('unexpected'))
    renderPage()
    fillAndSubmit('BLS-ABCDEF12')

    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument())
  })

  it('shows the inline extend-rental section for a confirmed booking', async () => {
    lookupMock.mockResolvedValue(confirmedResult)
    renderPage()
    fillAndSubmit('BLS-ABCDEF12')

    await waitFor(() => expect(screen.getByText('Extend This Rental')).toBeInTheDocument())
  })

  it('does not show the extend-rental section for a completed booking', async () => {
    lookupMock.mockResolvedValue(completedResult)
    renderPage()
    fillAndSubmit('BLS-99887766')

    await waitFor(() => expect(screen.getByText('BLS-99887766')).toBeInTheDocument())
    expect(screen.queryByText('Extend This Rental')).not.toBeInTheDocument()
  })

  // Phase 9D: every booking/payment email's "Manage your booking" button
  // links to /manage-booking?ref=BLS-XXXXXXXX (buildManageBookingUrl).
  describe('?ref= pre-fill from an email link (Phase 9D)', () => {
    it('pre-fills the lookup field from the ref query parameter, without auto-submitting', () => {
      renderPage(['/manage-booking?ref=BLS-ABCDEF12'])

      expect(screen.getByPlaceholderText('BLS-XXXXXXXX or ABC-123')).toHaveValue('BLS-ABCDEF12')
      expect(lookupMock).not.toHaveBeenCalled()
    })

    it('still looks up the booking once the customer presses the button themselves', async () => {
      lookupMock.mockResolvedValue(confirmedResult)
      renderPage(['/manage-booking?ref=BLS-ABCDEF12'])

      fireEvent.click(screen.getByRole('button', { name: /find my car/i }))

      await waitFor(() => expect(screen.getByText('BLS-ABCDEF12')).toBeInTheDocument())
      expect(lookupMock).toHaveBeenCalledWith('BLS-ABCDEF12')
    })

    it('leaves the field empty, exactly as before, when there is no ref parameter', () => {
      renderPage()
      expect(screen.getByPlaceholderText('BLS-XXXXXXXX or ABC-123')).toHaveValue('')
    })

    it('still lets the customer overwrite a pre-filled reference and search for something else', async () => {
      lookupMock.mockResolvedValue(confirmedResult)
      renderPage(['/manage-booking?ref=BLS-ABCDEF12'])

      fillAndSubmit('ABC-123')

      await waitFor(() => expect(lookupMock).toHaveBeenCalledWith('ABC-123'))
    })
  })

  // Checkout / Payment Flow Recovery, brief item 4: a customer whose
  // checkout was interrupted (different browser, closed tab…) must be
  // able to find their pending booking here and resume payment for the
  // SAME booking — never re-run create-booking, never lose the amount/
  // reference.
  describe('Continue to Payment for a pending_payment booking (checkout resume)', () => {
    it('shows a Continue to Payment action for a pending_payment booking', async () => {
      lookupMock.mockResolvedValue(pendingPaymentResult)
      renderPage()
      fillAndSubmit('BLS-E16F5DC3')

      await waitFor(() => expect(screen.getByText('BLS-E16F5DC3')).toBeInTheDocument())
      expect(screen.getByRole('button', { name: /continue to payment/i })).toBeInTheDocument()
    })

    it('does NOT show Continue to Payment for a confirmed booking', async () => {
      lookupMock.mockResolvedValue(confirmedResult)
      renderPage()
      fillAndSubmit('BLS-ABCDEF12')

      await waitFor(() => expect(screen.getByText('BLS-ABCDEF12')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: /continue to payment/i })).not.toBeInTheDocument()
    })

    it('resuming seeds the booking result + active-booking pointer and navigates straight to the Payment step', async () => {
      lookupMock.mockResolvedValue(pendingPaymentResult)
      renderPageWithCheckoutRoutes()
      fillAndSubmit('BLS-E16F5DC3')

      await waitFor(() => expect(screen.getByText('BLS-E16F5DC3')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

      await waitFor(() => expect(screen.getByText('PAYMENT PAGE')).toBeInTheDocument())
      expect(readBookingResult('bk-e16f5dc3')?.paymentId).toBe('pay-e16f5dc3')
      expect(
        readActiveBooking('veh-1', {
          startDate: '2026-10-01',
          endDate: '2026-10-09',
          pickupLocationId: 'loc-1',
          dropoffLocationId: 'loc-1',
        })?.bookingReference,
      ).toBe('BLS-E16F5DC3')
    })
  })

  // Phase 11 correction: the homepage navigator's Manage Booking panel
  // verifies reference + last name, then hands off here via router state
  // instead of asking the customer to look their booking up a second time.
  describe('arriving with a prefetched result (Phase 11 navigator hand-off)', () => {
    function renderWithPrefetchedResult(result: unknown) {
      return render(
        <MemoryRouter initialEntries={[{ pathname: '/manage-booking', state: { prefetchedResult: result } }]}>
          <ManageBookingPage />
        </MemoryRouter>,
      )
    }

    it('shows the booking summary immediately, without calling lookupBooking again', async () => {
      renderWithPrefetchedResult(confirmedResult)

      expect(screen.getByText('BLS-ABCDEF12')).toBeInTheDocument()
      expect(screen.getByText('Jane Renter')).toBeInTheDocument()
      expect(lookupMock).not.toHaveBeenCalled()
    })

    it('pre-fills the lookup field with the prefetched reference too', () => {
      renderWithPrefetchedResult(confirmedResult)
      expect(screen.getByPlaceholderText('BLS-XXXXXXXX or ABC-123')).toHaveValue('BLS-ABCDEF12')
    })

    it('still shows Continue to Payment for a prefetched pending_payment booking', () => {
      renderWithPrefetchedResult(pendingPaymentResult)
      expect(screen.getByRole('button', { name: /continue to payment/i })).toBeInTheDocument()
    })

    it('behaves exactly as before when there is no prefetched result', () => {
      renderPage()
      expect(screen.getByPlaceholderText('BLS-XXXXXXXX or ABC-123')).toHaveValue('')
      expect(screen.queryByText('BLS-ABCDEF12')).not.toBeInTheDocument()
    })
  })
})
