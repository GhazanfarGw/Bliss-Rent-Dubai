import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ManageBookingVerifyPanel } from '@/features/booking/ManageBookingVerifyPanel'
import { BookingLookupError } from '@/features/booking/lookupApi'
import { ExtendRentalError } from '@/features/booking/extendRentalApi'

const lookupMock = vi.fn()
const submitExtendMock = vi.fn()
const estimateMock = vi.fn()

vi.mock('@/features/booking/lookupApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/booking/lookupApi')>('@/features/booking/lookupApi')
  return {
    ...actual,
    lookupBooking: (...args: unknown[]) => lookupMock(...args),
  }
})

vi.mock('@/features/booking/extendRentalApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/booking/extendRentalApi')>('@/features/booking/extendRentalApi')
  return {
    ...actual,
    submitExtendRentalRequest: (...args: unknown[]) => submitExtendMock(...args),
  }
})

// The live price-preview hook (2026-09-05) does its own Supabase reads
// (get_extension_estimate_config, the public `pricing` table) — irrelevant
// to what THIS panel's own behavior tests care about, and not something a
// jsdom test should hit the network for. Mocked here exactly like
// lookupBooking/submitExtendRentalRequest above; its own math is covered
// by extensionPricing.test.ts / extensionPenalty.test.ts.
vi.mock('@/features/booking/useExtensionPriceEstimate', () => ({
  useExtensionPriceEstimate: (...args: unknown[]) => estimateMock(...args),
}))

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
  return user
}

describe('ManageBookingVerifyPanel', () => {
  beforeEach(() => {
    lookupMock.mockReset()
    submitExtendMock.mockReset()
    estimateMock.mockReset()
    estimateMock.mockReturnValue({
      status: 'unavailable',
      isLate: false,
      addedAmount: null,
      penaltyAmount: null,
      newTotal: null,
      currency: null,
    })
  })

  it('requires both the reference and the last name before submitting', async () => {
    renderPanel()
    await fillAndSubmit('BLS-ABCDEF12', '')

    expect(await screen.findByText(/enter both your booking reference and last name/i)).toBeInTheDocument()
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('shows the verified booking summary inline, without navigating away, once the reference and last name both verify', async () => {
    lookupMock.mockResolvedValue(foundResult)
    renderPanel()
    await fillAndSubmit('BLS-ABCDEF12', 'Renter')

    expect(await screen.findByText('BLS-ABCDEF12')).toBeInTheDocument()
    expect(screen.getByText('Toyota Camry')).toBeInTheDocument()
    // The lookup form fields are gone — we stayed on this panel instead of
    // navigating to the standalone Manage Booking page.
    expect(screen.queryByPlaceholderText('BLS-XXXXXXXX')).not.toBeInTheDocument()
    expect(lookupMock).toHaveBeenCalledWith('BLS-ABCDEF12')
  })

  it('shows a generic error, and stays on the form, when the reference does not exist', async () => {
    lookupMock.mockResolvedValue(null)
    renderPanel()
    await fillAndSubmit('BLS-NOTREAL1', 'Renter')

    expect(await screen.findByText(/couldn't verify a booking/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('BLS-XXXXXXXX')).toBeInTheDocument()
  })

  it('shows the SAME generic error, not a different one, when the reference exists but the last name does not match', async () => {
    lookupMock.mockResolvedValue(foundResult)
    renderPanel()
    await fillAndSubmit('BLS-ABCDEF12', 'Smith')

    expect(await screen.findByText(/couldn't verify a booking/i)).toBeInTheDocument()
  })

  it('surfaces a BookingLookupError message directly', async () => {
    lookupMock.mockRejectedValue(new BookingLookupError('connection failed'))
    renderPanel()
    await fillAndSubmit('BLS-ABCDEF12', 'Renter')

    expect(await screen.findByText('connection failed')).toBeInTheDocument()
  })

  it('lets the customer pick a day count and request an extension using the existing extension function, then shows the existing success result', async () => {
    lookupMock.mockResolvedValue(foundResult)
    submitExtendMock.mockResolvedValue({ extensionId: 'ext-1', status: 'requested', isLate: false })
    renderPanel()
    const user = await fillAndSubmit('BLS-ABCDEF12', 'Renter')

    await screen.findByText('BLS-ABCDEF12')
    await user.selectOptions(screen.getByLabelText(/additional days/i), '5')
    await user.click(screen.getByRole('button', { name: /submit request/i }))

    await waitFor(() =>
      expect(submitExtendMock).toHaveBeenCalledWith({
        bookingReference: 'BLS-ABCDEF12',
        vehicleNumber: 'ABC-123',
        requestedReturnDate: '2026-09-20',
      }),
    )
    expect(await screen.findByText(/request submitted/i)).toBeInTheDocument()
  })

  it('shows the existing loading state and disables the button while submitting, preventing a duplicate request, then shows the existing error result on failure', async () => {
    lookupMock.mockResolvedValue(foundResult)
    let rejectSubmit: (err: unknown) => void = () => {}
    submitExtendMock.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectSubmit = reject
      }),
    )
    renderPanel()
    const user = await fillAndSubmit('BLS-ABCDEF12', 'Renter')

    await screen.findByText('BLS-ABCDEF12')
    const submitButton = screen.getByRole('button', { name: /submit request/i })
    await user.click(submitButton)

    const submittingButton = await screen.findByRole('button', { name: /submitting/i })
    expect(submittingButton).toBeDisabled()

    // A second click while still in flight must not fire a second request.
    await user.click(submittingButton)
    expect(submitExtendMock).toHaveBeenCalledTimes(1)

    rejectSubmit(new ExtendRentalError('That booking can no longer be extended.'))
    expect(await screen.findByText('That booking can no longer be extended.')).toBeInTheDocument()
  })

  it('returns to the lookup form when "Verify another booking" is pressed', async () => {
    lookupMock.mockResolvedValue(foundResult)
    renderPanel()
    const user = await fillAndSubmit('BLS-ABCDEF12', 'Renter')

    await screen.findByText('BLS-ABCDEF12')
    await user.click(screen.getByRole('button', { name: /verify another booking/i }))

    expect(screen.getByPlaceholderText('BLS-XXXXXXXX')).toBeInTheDocument()
    expect(screen.queryByText('BLS-ABCDEF12')).not.toBeInTheDocument()
  })

  it('shows the paid / added / new-total price estimate once it resolves', async () => {
    lookupMock.mockResolvedValue(foundResult)
    estimateMock.mockReturnValue({
      status: 'ready',
      isLate: false,
      addedAmount: 500,
      penaltyAmount: null,
      newTotal: 1400,
      currency: 'AED',
    })
    renderPanel()
    await fillAndSubmit('BLS-ABCDEF12', 'Renter')

    await screen.findByText('BLS-ABCDEF12')
    // "AED 900" (the booking's already-paid total) appears both in the
    // existing summary card's Amount row and in the new estimate note's
    // "already paid" line — both are expected, not a duplicate bug.
    expect(screen.getAllByText('AED 900').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('AED 500')).toBeInTheDocument()
    expect(screen.getByText('AED 1,400')).toBeInTheDocument()
  })
})
