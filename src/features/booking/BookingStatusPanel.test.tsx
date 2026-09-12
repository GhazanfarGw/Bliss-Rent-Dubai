import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookingStatusPanel } from '@/features/booking/BookingStatusPanel'
import { BookingLookupError } from '@/features/booking/lookupApi'

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

async function fillAndSubmit(reference: string) {
  const user = userEvent.setup()
  if (reference) await user.type(screen.getByPlaceholderText('BLS-XXXXXXXX'), reference)
  await user.click(screen.getByRole('button', { name: /check status/i }))
}

describe('BookingStatusPanel', () => {
  beforeEach(() => {
    lookupMock.mockReset()
  })

  it('requires a booking reference before submitting', async () => {
    render(<BookingStatusPanel />)
    await fillAndSubmit('')

    expect(await screen.findByText(/please enter your booking reference/i)).toBeInTheDocument()
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('shows only Client Name / Car / Car Number / Days Left — never payment or pricing — once found', async () => {
    lookupMock.mockResolvedValue(foundResult)
    render(<BookingStatusPanel />)
    await fillAndSubmit('BLS-ABCDEF12')

    await waitFor(() => expect(screen.getByText('Jane Renter')).toBeInTheDocument())
    expect(screen.getByText('Toyota Camry')).toBeInTheDocument()
    expect(screen.getByText('ABC-123')).toBeInTheDocument()
    expect(screen.getByText('Days Left')).toBeInTheDocument()

    expect(screen.queryByText(/1,?500/)).not.toBeInTheDocument()
    expect(screen.queryByText(/paid/i)).not.toBeInTheDocument()
    expect(screen.queryByText('DXB Terminal 3')).not.toBeInTheDocument()
  })

  it('shows a not-found message when the reference does not match a booking', async () => {
    lookupMock.mockResolvedValue(null)
    render(<BookingStatusPanel />)
    await fillAndSubmit('BLS-NOTREAL1')

    expect(await screen.findByText(/couldn't find a booking/i)).toBeInTheDocument()
  })

  it('surfaces a BookingLookupError message directly', async () => {
    lookupMock.mockRejectedValue(new BookingLookupError('connection failed'))
    render(<BookingStatusPanel />)
    await fillAndSubmit('BLS-ABCDEF12')

    expect(await screen.findByText('connection failed')).toBeInTheDocument()
  })

  it('lets the customer check another booking after a result is shown', async () => {
    lookupMock.mockResolvedValue(foundResult)
    render(<BookingStatusPanel />)
    await fillAndSubmit('BLS-ABCDEF12')

    await waitFor(() => expect(screen.getByText('Jane Renter')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /check another booking/i }))

    expect(screen.getByPlaceholderText('BLS-XXXXXXXX')).toBeInTheDocument()
    expect(screen.queryByText('Jane Renter')).not.toBeInTheDocument()
  })
})
