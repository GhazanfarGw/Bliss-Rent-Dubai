import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { RentalExtensionsSection } from './RentalExtensionsSection'

const requestBookingExtensionMock = vi.fn()
const processExtensionRequestMock = vi.fn()

// A pending, customer-submitted extension request whose payment_method is
// already 'cash' — e.g. recorded before this rule existed, or entered by a
// super_admin over WhatsApp. Used to exercise the "stale state" scenario:
// a staff account opening this row for review gets paymentMethod:'cash' in
// form state directly from the extension record, never through the <select>
// (which never renders "Cash" for staff) — so handleSubmit's own guard is
// the only thing standing between this and a bypass.
const PENDING_CASH_EXTENSION = {
  id: 'ext-cash-pending-1',
  booking_id: 'booking-1',
  status: 'requested',
  previous_return_date: '2026-09-01',
  requested_return_date: '2026-09-05',
  extension_days: 4,
  is_late: false,
  payment_method: 'cash',
  support_confirmed_by: 'Jane (owner)', // pre-filled so validation passes on every field except the cash guard itself
  support_confirmation_note: null,
}

let fetchExtensionsForBookingMock = vi.fn().mockResolvedValue([])

vi.mock('./adminExtensionsApi', async () => {
  const actual = await vi.importActual<typeof import('./adminExtensionsApi')>('./adminExtensionsApi')
  return {
    ...actual,
    fetchExtensionsForBooking: (...args: unknown[]) => fetchExtensionsForBookingMock(...args),
    fetchBookingForExtension: vi.fn().mockResolvedValue({
      booking: { id: 'booking-1', end_date: '2026-09-01', start_date: '2026-08-25', total_price: 500, currency: 'AED' },
      vehicle: { id: 'vehicle-1', plate_number: 'ABC-123' },
      vehiclePricing: [{ id: 'p1', term: 'daily', client_price: 100, list_price: 100 }],
    }),
    fetchExtensionPricingSettings: vi.fn().mockResolvedValue({
      id: 1,
      policy: 'current_rate',
      custom_daily_rate: null,
      custom_currency: 'AED',
      updated_by: null,
      updated_at: null,
    }),
    fetchExtensionPenaltySettings: vi.fn().mockResolvedValue({
      id: 1,
      policy: 'percentage',
      percentage_rate: 10,
      per_day_amount: null,
      fixed_fee_amount: null,
      currency: 'AED',
      updated_by: null,
      updated_at: null,
    }),
    checkVehicleAvailabilityForExtension: vi.fn(),
    requestBookingExtension: (...args: unknown[]) => requestBookingExtensionMock(...args),
    processExtensionRequest: (...args: unknown[]) => processExtensionRequestMock(...args),
    rejectExtensionRequest: vi.fn(),
    confirmExtensionPayment: vi.fn(),
  }
})

let mockAdminRole: 'super_admin' | 'staff' = 'super_admin'

vi.mock('@/features/admin/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    adminProfile: { id: 'admin-1', full_name: 'Jane Admin', role: mockAdminRole, is_active: true, created_at: '2026-01-01' },
    session: { user: { email: 'jane@bliss.example' } },
    signOut: vi.fn(),
  }),
}))

afterEach(() => {
  mockAdminRole = 'super_admin'
  requestBookingExtensionMock.mockReset()
  processExtensionRequestMock.mockReset()
  fetchExtensionsForBookingMock = vi.fn().mockResolvedValue([])
})

async function openRecordForm() {
  render(<RentalExtensionsSection bookingId="booking-1" bookingStatus="confirmed" onBookingChanged={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: /record confirmed extension/i }))
}

/**
 * Business rule added 2026-08-29 (additive migration
 * 20260908000000_phase7_cash_extension_super_admin_only.sql): cash-payment
 * extensions require a super_admin. The database (is_super_admin() inside
 * request_booking_extension) is the real, authoritative gate — this covers
 * the client-side defense-in-depth half, mirroring the pattern already
 * used for extension pricing/penalty settings in AdminSettingsPage.test.tsx.
 */
describe('RentalExtensionsSection — cash extensions are super_admin only', () => {
  it('shows the Cash payment option for a super_admin', async () => {
    mockAdminRole = 'super_admin'
    await openRecordForm()
    const select = await screen.findByLabelText(/payment method/i)
    expect(within(select).getByRole('option', { name: 'Cash' })).toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'Online' })).toBeInTheDocument()
  })

  it('hides the Cash payment option for a regular staff account — the real gate is still DB-level (is_super_admin()), this is defense in depth', async () => {
    mockAdminRole = 'staff'
    await openRecordForm()
    const select = await screen.findByLabelText(/payment method/i)
    expect(within(select).queryByRole('option', { name: 'Cash' })).not.toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'Online' })).toBeInTheDocument()
    expect(screen.getByText(/cash payment is super-admin only/i)).toBeInTheDocument()
  })

  it('lets a super_admin select Cash and successfully submit a cash extension', async () => {
    mockAdminRole = 'super_admin'
    await openRecordForm()

    fireEvent.change(screen.getByLabelText(/new return date/i), { target: { value: '2026-09-05' } })
    fireEvent.change(screen.getByLabelText(/confirmed with customer by/i), { target: { value: 'Jane (owner)' } })
    fireEvent.change(screen.getByLabelText(/payment method/i), { target: { value: 'cash' } })
    expect(screen.getByLabelText(/payment method/i)).toHaveValue('cash')

    requestBookingExtensionMock.mockResolvedValue({
      extensionId: 'ext-1',
      status: 'approved',
      paymentStatus: 'paid',
      rejectionReason: null,
      isLate: false,
      penaltyAmount: null,
      conflictBookingId: null,
      replacementVehicleId: null,
    })
    fireEvent.click(screen.getByRole('button', { name: /submit extension request/i }))

    await waitFor(() => expect(requestBookingExtensionMock).toHaveBeenCalledTimes(1))
    expect(requestBookingExtensionMock.mock.calls[0][0].paymentMethod).toBe('cash')
  })

  it('lets a staff account see Online (not Cash) and successfully submit an online extension exactly as before', async () => {
    mockAdminRole = 'staff'
    await openRecordForm()

    const select = screen.getByLabelText(/payment method/i)
    expect(within(select).queryByRole('option', { name: 'Cash' })).not.toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'Online' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/new return date/i), { target: { value: '2026-09-05' } })
    fireEvent.change(screen.getByLabelText(/confirmed with customer by/i), { target: { value: 'Alex (staff)' } })
    fireEvent.change(select, { target: { value: 'online' } })

    requestBookingExtensionMock.mockResolvedValue({
      extensionId: 'ext-2',
      status: 'pending',
      paymentStatus: 'pending',
      rejectionReason: null,
      isLate: false,
      penaltyAmount: null,
      conflictBookingId: null,
      replacementVehicleId: null,
    })
    fireEvent.click(screen.getByRole('button', { name: /submit extension request/i }))

    await waitFor(() => expect(requestBookingExtensionMock).toHaveBeenCalledTimes(1))
    expect(requestBookingExtensionMock.mock.calls[0][0].paymentMethod).toBe('online')
  })

  it('blocks a staff account from submitting Cash even when it arrives as stale state — reviewing an existing request that was already recorded as cash, never through the <select> — the database is the real gate', async () => {
    mockAdminRole = 'staff'
    fetchExtensionsForBookingMock = vi.fn().mockResolvedValue([PENDING_CASH_EXTENSION])
    render(<RentalExtensionsSection bookingId="booking-1" bookingStatus="confirmed" onBookingChanged={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: /review/i }))
    // openReview() sets form.paymentMethod straight from the extension record's own
    // payment_method — 'cash' — without ever touching the <select>, which for staff never
    // renders a "Cash" option at all. The rendered select can't reflect a value with no
    // matching option, but the component's internal form state still holds 'cash', which is
    // exactly the "stale state" handleSubmit's own guard exists to catch.
    expect(within(screen.getByLabelText(/payment method/i)).queryByRole('option', { name: 'Cash' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /submit extension request/i }))

    expect(requestBookingExtensionMock).not.toHaveBeenCalled()
    expect(processExtensionRequestMock).not.toHaveBeenCalled()
    expect(await screen.findByText(/cash payment is super-admin only/i)).toBeInTheDocument()
  })
})
