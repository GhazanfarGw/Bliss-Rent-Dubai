import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ConfirmationPage } from './ConfirmationPage'
import { saveConfirmationSnapshot } from './checkoutStorage'
import type { BookingConfirmationSnapshot } from '@/types/domain'

const snapshot: BookingConfirmationSnapshot = {
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

function renderAt(bookingId: string) {
  return render(
    <MemoryRouter initialEntries={[`/checkout/veh-1/confirmation/${bookingId}`]}>
      <Routes>
        <Route path="/checkout/:id/confirmation/:bookingId" element={<ConfirmationPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ConfirmationPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('shows the booking reference and key details for a confirmed booking', () => {
    saveConfirmationSnapshot(snapshot)
    renderAt('bk-1')

    expect(screen.getByText('BLS-ABCDEF12')).toBeInTheDocument()
    expect(screen.getByText('Toyota Camry')).toBeInTheDocument()
    expect(screen.getByText('Jane Renter')).toBeInTheDocument()
    expect(screen.getByText('John Driver')).toBeInTheDocument()
    expect(screen.getByText('AED 900')).toBeInTheDocument()
    expect(screen.getByText('Booking confirmed')).toBeInTheDocument()
  })

  it('never claims the vehicle has been physically handed over', () => {
    saveConfirmationSnapshot(snapshot)
    renderAt('bk-1')
    expect(screen.getByText(/has not been handed over yet/i)).toBeInTheDocument()
  })

  it('shows a not-found state, not fake data, when no snapshot exists for this browser', () => {
    renderAt('bk-does-not-exist')
    expect(screen.getByText(/we can't find that confirmation/i)).toBeInTheDocument()
    expect(screen.queryByText('BLS-ABCDEF12')).not.toBeInTheDocument()
  })
})
