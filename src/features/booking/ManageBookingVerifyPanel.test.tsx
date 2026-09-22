import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ManageBookingVerifyPanel } from '@/features/booking/ManageBookingVerifyPanel'
import { BookingLookupError } from '@/features/booking/lookupApi'
import { ExtendRentalError } from '@/features/booking/extendRentalApi'

const lookupMock = vi.fn()
const submitExtendMock = vi.fn()

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

// Computed relative to the real clock (in local calendar terms, no UTC
// conversion) rather than hardcoded, so the "remaining days" and
// extension-date assertions below stay correct no matter what day the
// suite actually runs on or which timezone the machine is in.
function localIsoDatePlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Byte-identical to the component's own (private) addDaysToIsoDate, so an
// assertion built from this always matches what the component actually
// computes — including its use of toISOString(), which is TZ-sensitive.
function addDaysToIsoDate(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const REMAINING_DAYS = 5

const confirmedResult = {
  bookingId: 'bk-1',
  bookingReference: 'BLS-ABCDEF12',
  bookingStatus: 'confirmed',
  startDate: localIsoDatePlusDays(0),
  endDate: localIsoDatePlusDays(REMAINING_DAYS),
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

const pendingPaymentResult = {
  ...confirmedResult,
  bookingId: 'bk-2',
  bookingReference: 'BLS-PENDING01',
  bookingStatus: 'pending_payment',
  paymentStatus: 'pending',
}

const completedResult = {
  ...confirmedResult,
  bookingId: 'bk-3',
  bookingReference: 'BLS-DONE00001',
  bookingStatus: 'completed',
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <ManageBookingVerifyPanel />
    </MemoryRouter>,
  )
}

function renderPanelWithCheckoutRoutes() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ManageBookingVerifyPanel />} />
        <Route path="/checkout/:id/payment/:bookingId" element={<div>PAYMENT PAGE</div>} />
      </Routes>
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
  })

  it('requires both the reference and the last name before submitting', async () => {
    renderPanel()
    await fillAndSubmit('BLS-ABCDEF12', '')

    expect(await screen.findByText(/enter both your booking reference and last name/i)).toBeInTheDocument()
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('shows the verified booking as a single compact row — reference, last name, remaining days, extend controls — with no details section underneath', async () => {
    lookupMock.mockResolvedValue(confirmedResult)
    renderPanel()
    await fillAndSubmit('BLS-ABCDEF12', 'Renter')

    expect(await screen.findByText('BLS-ABCDEF12')).toBeInTheDocument()
    expect(screen.getByText('Renter')).toBeInTheDocument()
    const remainingDaysField = screen.getByText('Remaining Rental Days').closest('div')
    expect(within(remainingDaysField!).getByText(`${REMAINING_DAYS} days`)).toBeInTheDocument()
    expect(screen.getByLabelText(/extend rental days/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^extend rental$/i })).toBeInTheDocument()
    // No long vehicle/trip detail section underneath the row.
    expect(screen.queryByText('Toyota Camry')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pay now/i })).not.toBeInTheDocument()
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
    lookupMock.mockResolvedValue(confirmedResult)
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

  describe('payment pending', () => {
    it('shows Payment Pending with a Pay Now action, and no Extend Rental control at all', async () => {
      lookupMock.mockResolvedValue(pendingPaymentResult)
      renderPanel()
      await fillAndSubmit('BLS-PENDING01', 'Renter')

      expect(await screen.findByText('Payment Pending')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /pay now/i })).toBeInTheDocument()
      expect(screen.queryByLabelText(/extend rental days/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^extend rental$/i })).not.toBeInTheDocument()
    })

    it('Pay Now resumes the booking and navigates straight to the existing checkout payment step', async () => {
      lookupMock.mockResolvedValue(pendingPaymentResult)
      renderPanelWithCheckoutRoutes()
      const user = await fillAndSubmit('BLS-PENDING01', 'Renter')

      await screen.findByText('Payment Pending')
      await user.click(screen.getByRole('button', { name: /pay now/i }))

      expect(await screen.findByText('PAYMENT PAGE')).toBeInTheDocument()
    })
  })

  it('shows just the booking status, with no action, for a paid booking that cannot be extended', async () => {
    lookupMock.mockResolvedValue(completedResult)
    renderPanel()
    await fillAndSubmit('BLS-DONE00001', 'Renter')

    expect(await screen.findByText('BLS-DONE00001')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pay now/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/extend rental days/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^extend rental$/i })).not.toBeInTheDocument()
  })

  it('lets the customer pick a day count and request an extension using the existing extension function, then shows a compact success message', async () => {
    lookupMock.mockResolvedValue(confirmedResult)
    submitExtendMock.mockResolvedValue({ extensionId: 'ext-1', status: 'requested', isLate: false })
    renderPanel()
    const user = await fillAndSubmit('BLS-ABCDEF12', 'Renter')

    await screen.findByText('BLS-ABCDEF12')
    await user.selectOptions(screen.getByLabelText(/extend rental days/i), '5')
    await user.click(screen.getByRole('button', { name: /^extend rental$/i }))

    await waitFor(() =>
      expect(submitExtendMock).toHaveBeenCalledWith({
        bookingReference: 'BLS-ABCDEF12',
        vehicleNumber: 'ABC-123',
        requestedReturnDate: addDaysToIsoDate(confirmedResult.endDate, 5),
      }),
    )
    expect(await screen.findByText(/request submitted/i)).toBeInTheDocument()
  })

  it('shows the existing loading state and disables the button while submitting, preventing a duplicate request, then shows the existing error result on failure', async () => {
    lookupMock.mockResolvedValue(confirmedResult)
    let rejectSubmit: (err: unknown) => void = () => {}
    submitExtendMock.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectSubmit = reject
      }),
    )
    renderPanel()
    const user = await fillAndSubmit('BLS-ABCDEF12', 'Renter')

    await screen.findByText('BLS-ABCDEF12')
    const submitButton = screen.getByRole('button', { name: /^extend rental$/i })
    await user.click(submitButton)

    const submittingButton = await screen.findByRole('button', { name: /submitting/i })
    expect(submittingButton).toBeDisabled()

    // A second click while still in flight must not fire a second request.
    await user.click(submittingButton)
    expect(submitExtendMock).toHaveBeenCalledTimes(1)

    rejectSubmit(new ExtendRentalError('That booking can no longer be extended.'))
    expect(await screen.findByText('That booking can no longer be extended.')).toBeInTheDocument()
  })

  it('returns to the lookup form when the reset action is pressed', async () => {
    lookupMock.mockResolvedValue(confirmedResult)
    renderPanel()
    const user = await fillAndSubmit('BLS-ABCDEF12', 'Renter')

    await screen.findByText('BLS-ABCDEF12')
    await user.click(screen.getByRole('button', { name: /verify another booking/i }))

    expect(screen.getByPlaceholderText('BLS-XXXXXXXX')).toBeInTheDocument()
    expect(screen.queryByText('BLS-ABCDEF12')).not.toBeInTheDocument()
  })
})
