import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { FindMyCarPage } from '@/features/booking/FindMyCarPage'

const lookupMock = vi.fn()

vi.mock('@/features/booking/lookupApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/booking/lookupApi')>('@/features/booking/lookupApi')
  return {
    ...actual,
    lookupBooking: (...args: unknown[]) => lookupMock(...args),
  }
})

const foundResult = {
  bookingId: 'bk-1',
  bookingReference: 'BLS-ABCDEF12',
  bookingStatus: 'confirmed',
  startDate: '2026-09-08',
  endDate: '2026-09-20',
  totalPrice: 1500,
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

function renderPage() {
  return render(
    <MemoryRouter>
      <FindMyCarPage />
    </MemoryRouter>,
  )
}

describe('FindMyCarPage', () => {
  beforeEach(() => {
    lookupMock.mockReset()
  })

  it('renders the Booking Status hero and a status-only lookup — no extend/pay UI at all', async () => {
    lookupMock.mockResolvedValue(foundResult)
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Booking Status' })).toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('BLS-XXXXXXXX'), 'BLS-ABCDEF12')
    await user.click(screen.getByRole('button', { name: /check status/i }))

    await waitFor(() => expect(screen.getByText('Jane Renter')).toBeInTheDocument())
    expect(screen.getByText('Toyota Camry')).toBeInTheDocument()
    expect(screen.getByText('ABC-123')).toBeInTheDocument()
    expect(screen.getByText('Days Left')).toBeInTheDocument()

    // Never shows pricing, payment status, or extend/pay actions —
    // that's Manage Booking's job, not Find My Car's.
    expect(screen.queryByText(/1,?500/)).not.toBeInTheDocument()
    expect(screen.queryByText(/paid/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue to payment/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/extend this rental/i)).not.toBeInTheDocument()
  })

  it('links back to the homepage', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })
})
