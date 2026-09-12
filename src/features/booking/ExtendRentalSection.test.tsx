import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExtendRentalSection } from './ExtendRentalSection'
import { ExtendRentalError } from './extendRentalApi'

const submitMock = vi.fn()
const estimateMock = vi.fn()

vi.mock('./extendRentalApi', async () => {
  const actual = await vi.importActual<typeof import('./extendRentalApi')>('./extendRentalApi')
  return {
    ...actual,
    submitExtendRentalRequest: (...args: unknown[]) => submitMock(...args),
  }
})

// The live price-preview hook (2026-09-05) does its own Supabase reads —
// irrelevant to what this file's own tests cover, and not something a
// jsdom test should hit the network for. Its own math is covered by
// extensionPricing.test.ts / extensionPenalty.test.ts.
vi.mock('@/features/booking/useExtensionPriceEstimate', () => ({
  useExtensionPriceEstimate: (...args: unknown[]) => estimateMock(...args),
}))

const props = {
  bookingReference: 'BLS-ABCDEF12',
  vehicleNumber: 'ABC-123',
  currentReturnDate: '2026-09-15',
  vehicleId: 'veh-1',
  originalStartDate: '2026-09-10',
  currentTotalPrice: 900,
  currency: 'AED',
}

function fillAndSubmit(newDate: string) {
  fireEvent.change(screen.getByLabelText(/new return date/i), { target: { value: newDate } })
  fireEvent.click(screen.getByRole('button', { name: /submit request/i }))
}

describe('ExtendRentalSection', () => {
  beforeEach(() => {
    submitMock.mockReset()
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

  it('submits the request with the booking reference and vehicle number passed in as props', async () => {
    submitMock.mockResolvedValue({ extensionId: 'ext-1', status: 'requested', isLate: false })
    render(<ExtendRentalSection {...props} />)

    fillAndSubmit('2026-09-18')

    await waitFor(() => expect(screen.getByText('Request submitted')).toBeInTheDocument())
    expect(submitMock).toHaveBeenCalledWith({
      bookingReference: 'BLS-ABCDEF12',
      vehicleNumber: 'ABC-123',
      requestedReturnDate: '2026-09-18',
    })
  })

  it('shows a days-requested preview once a new date is chosen', () => {
    render(<ExtendRentalSection {...props} />)
    fireEvent.change(screen.getByLabelText(/new return date/i), { target: { value: '2026-09-18' } })

    expect(screen.getByText('3 extra days requested')).toBeInTheDocument()
  })

  it('surfaces the late-extension note when the submitted request is flagged late', async () => {
    submitMock.mockResolvedValue({ extensionId: 'ext-2', status: 'requested', isLate: true })
    render(<ExtendRentalSection {...props} />)

    fillAndSubmit('2026-09-20')

    await waitFor(() => expect(screen.getByText('Request submitted')).toBeInTheDocument())
    expect(screen.getByText(/late-extension fee may apply/i)).toBeInTheDocument()
  })

  it('shows the ExtendRentalError message directly when submission fails', async () => {
    submitMock.mockRejectedValue(new ExtendRentalError('That vehicle is not available for those dates.'))
    render(<ExtendRentalSection {...props} />)

    fillAndSubmit('2026-09-18')

    await waitFor(() =>
      expect(screen.getByText('That vehicle is not available for those dates.')).toBeInTheDocument(),
    )
  })

  it('shows a generic error message for an unexpected (non-ExtendRentalError) failure', async () => {
    submitMock.mockRejectedValue(new Error('unexpected'))
    render(<ExtendRentalSection {...props} />)

    fillAndSubmit('2026-09-18')

    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument())
  })
})
