import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PendingBookingIndicator } from './PendingBookingIndicator'
import { saveActiveBooking, clearActiveBooking, type ActiveBookingPointer } from '@/features/booking/checkout/checkoutStorage'

// The indicator now validates its pointer against the server (see the bug
// fix in PendingBookingIndicator.tsx) — mocked here the same way
// ManageBookingPage.test.tsx mocks it, so these tests exercise the
// component in isolation rather than making a real network call.
const lookupMock = vi.fn()

vi.mock('@/features/booking/lookupApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/booking/lookupApi')>('@/features/booking/lookupApi')
  return {
    ...actual,
    lookupBooking: (...args: unknown[]) => lookupMock(...args),
  }
})

const pointer: ActiveBookingPointer = {
  vehicleId: 'veh-1',
  vehicleMake: 'MG',
  vehicleModel: '5',
  startDate: '2026-10-01',
  endDate: '2026-10-09',
  pickupLocationId: 'loc-1',
  dropoffLocationId: 'loc-1',
  pickupLocationName: 'Sharjah City Centre',
  dropoffLocationName: 'Sharjah City Centre',
  bookingId: 'bk-e16f5dc3',
  bookingReference: 'BLS-E16F5DC3',
  paymentId: 'pay-e16f5dc3',
  totalPrice: 952,
  currency: 'AED',
}

function renderIndicator(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="/"
          element={<PendingBookingIndicator />}
        />
        <Route path="/checkout/:id/payment/:bookingId" element={<div>PAYMENT PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PendingBookingIndicator (header reminder)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    lookupMock.mockReset()
    // Default: the booking still exists and is still awaiting payment —
    // matches every pre-existing test's assumption below, none of which
    // are about server validation.
    lookupMock.mockResolvedValue({ bookingStatus: 'pending_payment' })
  })

  it('renders nothing at all when there is no pending booking — never a misleading count', () => {
    renderIndicator()
    expect(screen.queryByRole('button', { name: /my booking/i })).not.toBeInTheDocument()
  })

  it('shows a count of 1 and the booking details when a pending booking exists', () => {
    saveActiveBooking(pointer)
    renderIndicator()

    const button = screen.getByRole('button', { name: /my booking/i })
    expect(button).toBeInTheDocument()
    fireEvent.click(button)

    expect(screen.getByText('MG 5')).toBeInTheDocument()
    expect(screen.getByText('BLS-E16F5DC3')).toBeInTheDocument()
    expect(screen.getByText('952')).toBeInTheDocument()
  })

  it('"Continue to payment" navigates straight to the Payment step for that booking', () => {
    saveActiveBooking(pointer)
    renderIndicator()

    fireEvent.click(screen.getByRole('button', { name: /my booking/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }))

    expect(screen.getByText('PAYMENT PAGE')).toBeInTheDocument()
  })

  it('disappears once the pending booking is cleared (e.g. after payment succeeds)', () => {
    saveActiveBooking(pointer)
    const { rerender } = renderIndicator()
    expect(screen.getByRole('button', { name: /my booking/i })).toBeInTheDocument()

    clearActiveBooking('veh-1')
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<PendingBookingIndicator />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: /my booking/i })).not.toBeInTheDocument()
  })

  it('REGRESSION: a booking that no longer exists on the server (e.g. an admin data reset) stops showing, instead of lingering forever', async () => {
    // Reported bug: the reminder trusted this sessionStorage pointer
    // forever, with nothing ever re-checking it against the server — so a
    // booking deleted server-side (admin reset/test-data wipe) kept
    // showing here indefinitely, pointing at a payment page for a booking
    // that no longer existed.
    lookupMock.mockResolvedValue(null) // the RPC's "no such booking" result
    saveActiveBooking(pointer)
    renderIndicator()

    expect(screen.getByRole('button', { name: /my booking/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /my booking/i })).not.toBeInTheDocument()
    })
    expect(lookupMock).toHaveBeenCalledWith(pointer.bookingReference)
  })

  it('REGRESSION: a booking resolved elsewhere (paid/cancelled from another device) also stops showing here', async () => {
    lookupMock.mockResolvedValue({ bookingStatus: 'paid' })
    saveActiveBooking(pointer)
    renderIndicator()

    expect(screen.getByRole('button', { name: /my booking/i })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /my booking/i })).not.toBeInTheDocument()
    })
  })

  it('a transient lookup failure does not falsely clear a real pending booking', async () => {
    lookupMock.mockRejectedValue(new Error('network hiccup'))
    saveActiveBooking(pointer)
    renderIndicator()

    expect(screen.getByRole('button', { name: /my booking/i })).toBeInTheDocument()
    await waitFor(() => expect(lookupMock).toHaveBeenCalled())
    // Give any (incorrect) clear-on-error path a chance to run before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByRole('button', { name: /my booking/i })).toBeInTheDocument()
  })
})
