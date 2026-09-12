import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { CurrentRentedCarsSection } from './CurrentRentedCarsSection'
import { formatBookingReference } from '@/lib/bookingReference'

const requestBookingExtensionMock = vi.fn()

function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// vi.mock factories are hoisted above the rest of the file, so the shared
// fixture must be created via vi.hoisted rather than a plain top-level
// const — otherwise the factory below runs before ON_TIME_CAR exists.
const { ON_TIME_CAR } = vi.hoisted(() => {
  function today(): string {
    return new Date().toISOString().slice(0, 10)
  }
  function plusDays(dateIso: string, days: number): string {
    const d = new Date(`${dateIso}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }
  return {
    ON_TIME_CAR: {
      id: 'booking-current-1',
      start_date: plusDays(today(), -5),
      end_date: plusDays(today(), 2), // still on-time (in the future)
      status: 'active',
      total_price: 500,
      currency: 'AED',
      customers: { id: 'cust-1', full_name: 'Ghazanfar Abbas' },
      vehicles: {
        id: 'vehicle-1',
        make: 'Suzuki',
        model: 'Alto XVR',
        plate_number: '78456',
        pricing: [{ id: 'p1', term: 'daily', client_price: 100, currency: 'AED' }],
      },
      payments: [{ status: 'paid' }],
    },
  }
})

vi.mock('./adminExtensionsApi', async () => {
  const actual = await vi.importActual<typeof import('./adminExtensionsApi')>('./adminExtensionsApi')
  return {
    ...actual,
    fetchCurrentRentedCars: vi.fn().mockResolvedValue([ON_TIME_CAR]),
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
    checkVehicleAvailabilityForExtension: vi.fn().mockResolvedValue(true),
    requestBookingExtension: (...args: unknown[]) => requestBookingExtensionMock(...args),
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
})

async function renderAndOpenPanel() {
  render(<CurrentRentedCarsSection onExtended={vi.fn()} />)
  const extendButton = await screen.findByRole('button', { name: /extend rental/i })
  fireEvent.click(extendButton)
}

describe('CurrentRentedCarsSection', () => {
  it('lists the current rented car with customer, booking reference, vehicle, plate, current return, status, payment and days', async () => {
    render(<CurrentRentedCarsSection onExtended={vi.fn()} />)

    expect(await screen.findByText('Ghazanfar Abbas')).toBeInTheDocument()
    expect(screen.getByText(formatBookingReference(ON_TIME_CAR.id))).toBeInTheDocument()
    expect(screen.getByText(/Suzuki Alto XVR/)).toBeInTheDocument()
    expect(screen.getByText('78456')).toBeInTheDocument()
    expect(screen.getByText(ON_TIME_CAR.end_date)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /extend rental/i })).toBeInTheDocument()
  })

  it('shows an empty state when nothing is currently rented', async () => {
    const api = await import('./adminExtensionsApi')
    vi.mocked(api.fetchCurrentRentedCars).mockResolvedValueOnce([])
    render(<CurrentRentedCarsSection onExtended={vi.fn()} />)
    expect(await screen.findByText(/no cars currently rented/i)).toBeInTheDocument()
  })

  it('opens the Extend Rental panel showing the exact current booking', async () => {
    await renderAndOpenPanel()
    expect(await screen.findByRole('heading', { name: /extend rental/i })).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(formatBookingReference(ON_TIME_CAR.id))).length).toBeGreaterThanOrEqual(1)
  })

  it('rejects extension days outside 1-30 and disables Review until valid', async () => {
    await renderAndOpenPanel()
    const daysInput = screen.getByLabelText(/extension days/i)
    const reviewButton = screen.getByRole('button', { name: /review extension/i })

    fireEvent.change(daysInput, { target: { value: '0' } })
    expect(reviewButton).toBeDisabled()

    fireEvent.change(daysInput, { target: { value: '31' } })
    expect(reviewButton).toBeDisabled()

    fireEvent.change(daysInput, { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText(/confirmed by/i), { target: { value: 'Ghazanfar (owner)' } })
    fireEvent.change(screen.getByLabelText(/payment method/i), { target: { value: 'online' } })
    await waitFor(() => expect(reviewButton).not.toBeDisabled())
  })

  it('previews the correct new return date and total (daily rate x days), and reaches the Confirm Rental Extension step', async () => {
    await renderAndOpenPanel()
    fireEvent.change(screen.getByLabelText(/extension days/i), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText(/payment method/i), { target: { value: 'online' } })

    const expectedNewReturn = addDays(ON_TIME_CAR.end_date, 5)
    await waitFor(() => expect(screen.getAllByText(new RegExp(expectedNewReturn)).length).toBeGreaterThanOrEqual(1))
    // AED 100/day x 5 days = AED 500, on-time so no penalty — appears as both the amount and the total
    expect(screen.getAllByText(/AED 500/).length).toBeGreaterThanOrEqual(2)

    fireEvent.click(screen.getByRole('button', { name: /review extension/i }))
    expect(await screen.findByRole('heading', { name: /confirm rental extension/i })).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(expectedNewReturn)).length).toBeGreaterThanOrEqual(1)
  })

  it('renders nothing at all for a staff account — no section, no Extend Rental button, and never fetches (Super Admin only, 2026-08-29 direction)', async () => {
    mockAdminRole = 'staff'
    const api = await import('./adminExtensionsApi')
    vi.mocked(api.fetchCurrentRentedCars).mockClear()
    vi.mocked(api.fetchExtensionPricingSettings).mockClear()
    const { container } = render(<CurrentRentedCarsSection onExtended={vi.fn()} />)

    // Give any stray effect a tick to fire, then assert nothing rendered and nothing was fetched.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText(/current rented cars/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /extend rental/i })).not.toBeInTheDocument()
    expect(api.fetchCurrentRentedCars).not.toHaveBeenCalled()
    expect(api.fetchExtensionPricingSettings).not.toHaveBeenCalled()
  })

  it('shows Cash for a super_admin account', async () => {
    mockAdminRole = 'super_admin'
    await renderAndOpenPanel()
    const select = screen.getByLabelText(/payment method/i)
    expect(within(select).getByRole('option', { name: 'Cash' })).toBeInTheDocument()
  })

  it('requires the second Confirm Extension click before calling the extension engine, then submits the exact expected payload', async () => {
    await renderAndOpenPanel()
    fireEvent.change(screen.getByLabelText(/extension days/i), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText(/confirmed by/i), { target: { value: 'Ghazanfar (owner)' } })
    fireEvent.change(screen.getByLabelText(/payment method/i), { target: { value: 'cash' } })
    fireEvent.click(screen.getByRole('button', { name: /review extension/i }))

    await screen.findByRole('heading', { name: /confirm rental extension/i })
    expect(requestBookingExtensionMock).not.toHaveBeenCalled()

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
    fireEvent.click(screen.getByRole('button', { name: /confirm extension/i }))

    await waitFor(() => expect(requestBookingExtensionMock).toHaveBeenCalledTimes(1))
    const call = requestBookingExtensionMock.mock.calls[0][0]
    expect(call.bookingId).toBe(ON_TIME_CAR.id)
    expect(call.requestedReturnDate).toBe(addDays(ON_TIME_CAR.end_date, 5))
    expect(call.paymentMethod).toBe('cash')
    expect(call.amount).toBe(500)
    expect(call.currency).toBe('AED')
    expect(call.pricingPolicyUsed).toBe('current_rate')
    expect(call.penaltyAmount).toBeNull()
    expect(call.supportConfirmedBy).toBe('Ghazanfar (owner)')
  })

  it('re-renders to nothing (and stops offering Extend Rental) the instant the signed-in role stops being super_admin', async () => {
    // Covers the case the render-level gate is meant for: a role change during an
    // already-open session, not just a fresh page load as staff. The database's
    // is_super_admin() check inside request_booking_extension remains the actual,
    // unbypassable gate for cash regardless of what this component does.
    const { rerender } = render(<CurrentRentedCarsSection onExtended={vi.fn()} />)
    expect(await screen.findByRole('button', { name: /extend rental/i })).toBeInTheDocument()

    mockAdminRole = 'staff'
    rerender(<CurrentRentedCarsSection onExtended={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /extend rental/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/current rented cars/i)).not.toBeInTheDocument()
  })
})
