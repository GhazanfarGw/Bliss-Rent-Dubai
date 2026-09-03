import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PendingBookingIndicator } from './PendingBookingIndicator'
import { saveActiveBooking, clearActiveBooking, type ActiveBookingPointer } from '@/features/booking/checkout/checkoutStorage'

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
    expect(screen.getByText('AED 952')).toBeInTheDocument()
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
})
