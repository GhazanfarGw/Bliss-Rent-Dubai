import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ManageBookingVerifyPanel } from '@/features/booking/ManageBookingVerifyPanel'
import { BookingLookupError } from '@/features/booking/lookupApi'

const lookupMock = vi.fn()
const navigateMock = vi.fn()

vi.mock('@/features/booking/lookupApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/booking/lookupApi')>('@/features/booking/lookupApi')
  return {
    ...actual,
    lookupBooking: (...args: unknown[]) => lookupMock(...args),
  }
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

const foundResult = {
  bookingId: 'bk-1',
  bookingReference: 'BLS-ABCDEF12',
  bookingStatus: 'confirmed',
  startDate: '2026-09-10',
  endDate: '2026-09-15',
  totalPrice: 900,
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

function renderPanel() {
  return render(
    <MemoryRouter>
      <ManageBookingVerifyPanel />
    </MemoryRouter>,
  )
}

async function fillAndSubmit(reference: string, lastName: string) {
  const user = userEvent.setup()
  if (reference) await user.type(screen.getByPlaceholderText('BLS-XXXXXXXX'), reference)
  if (lastName) await user.type(screen.getByPlaceholderText(/renter/i), lastName)
  await user.click(screen.getByRole('button', { name: /verify & manage booking/i }))
}

describe('ManageBookingVerifyPanel', () => {
  beforeEach(() => {
    lookupMock.mockReset()
    navigateMock.mockReset()
  })

  it('requires both the reference and the last name before submitting', async () => {
    renderPanel()
    await fillAndSubmit('BLS-ABCDEF12', '')

    expect(await screen.findByText(/enter both your booking reference and last name/i)).toBeInTheDocument()
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('navigates to /manage-booking with the prefetched result once the reference and last name both verify', async () => {
    lookupMock.mockResolvedValue(foundResult)
    renderPanel()
    await fillAndSubmit('BLS-ABCDEF12', 'Renter')

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/manage-booking', { state: { prefetchedResult: foundResult } }),
    )
    expect(lookupMock).toHaveBeenCalledWith('BLS-ABCDEF12')
  })

  it('shows a generic error, and does not navigate, when the reference does not exist', async () => {
    lookupMock.mockResolvedValue(null)
    renderPanel()
    await fillAndSubmit('BLS-NOTREAL1', 'Renter')

    expect(await screen.findByText(/couldn't verify a booking/i)).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('shows the SAME generic error, not a different one, when the reference exists but the last name does not match', async () => {
    lookupMock.mockResolvedValue(foundResult)
    renderPanel()
    await fillAndSubmit('BLS-ABCDEF12', 'Smith')

    expect(await screen.findByText(/couldn't verify a booking/i)).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('surfaces a BookingLookupError message directly', async () => {
    lookupMock.mockRejectedValue(new BookingLookupError('connection failed'))
    renderPanel()
    await fillAndSubmit('BLS-ABCDEF12', 'Renter')

    expect(await screen.findByText('connection failed')).toBeInTheDocument()
  })
})
