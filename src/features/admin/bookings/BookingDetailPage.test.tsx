import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { BookingDetailPage } from './BookingDetailPage'
import type { AdminBookingWithDetails } from '@/types/domain'

const fetchBookingByIdMock = vi.fn()
const adminConfirmBookingPaymentMock = vi.fn()
const adminCancelBookingMock = vi.fn()
const adminStartRentalMock = vi.fn()
const adminMarkReturnedMock = vi.fn()

vi.mock('./adminBookingsApi', async () => {
  const actual = await vi.importActual<typeof import('./adminBookingsApi')>('./adminBookingsApi')
  return {
    ...actual,
    fetchBookingById: (...args: unknown[]) => fetchBookingByIdMock(...args),
    fetchBookingStatusHistory: vi.fn().mockResolvedValue([]),
    adminConfirmBookingPayment: (...args: unknown[]) => adminConfirmBookingPaymentMock(...args),
    adminCancelBooking: (...args: unknown[]) => adminCancelBookingMock(...args),
    adminStartRental: (...args: unknown[]) => adminStartRentalMock(...args),
    adminMarkReturned: (...args: unknown[]) => adminMarkReturnedMock(...args),
  }
})

// The extensions section does its own fetching and is unrelated to this
// page's payment-confirmation action — stub it out so this test file
// stays focused.
vi.mock('@/features/admin/extensions/RentalExtensionsSection', () => ({
  RentalExtensionsSection: () => null,
}))

let mockAdminRole: 'super_admin' | 'staff' = 'super_admin'
vi.mock('@/features/admin/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    adminProfile: { id: 'admin-1', full_name: 'Jane Admin', role: mockAdminRole, is_active: true, created_at: '2026-01-01' },
    session: { user: { email: 'jane@bliss.example' } },
    signOut: vi.fn(),
  }),
}))

const pendingBooking: AdminBookingWithDetails = {
  id: 'bk-e16f5dc3',
  customer_id: 'cust-1',
  vehicle_id: 'veh-1',
  pickup_location_id: 'loc-1',
  dropoff_location_id: 'loc-1',
  term: 'weekly',
  start_date: '2026-10-01',
  end_date: '2026-10-09',
  status: 'pending_payment',
  total_price: 952,
  currency: 'AED',
  created_at: '2026-09-02T13:11:05.850Z',
  updated_at: '2026-09-02T13:11:05.850Z',
  customers: { id: 'cust-1', full_name: 'Ghazanfar Abbas', email: 'g@example.com', phone: null, auth_user_id: null, created_at: '' },
  vehicles: {
    id: 'veh-1',
    category_id: 'cat-eco',
    make: 'MG',
    model: '5',
    model_year: 2024,
    transmission: 'automatic',
    seats: 5,
    plate_number: 'TEMP-ECO-04',
    status: 'available',
    created_at: '',
    vehicle_categories: { id: 'cat-eco', name: 'Economy', description: null },
  },
  pickup_location: { id: 'loc-1', name: 'Sharjah City Centre', is_active: true } as never,
  dropoff_location: { id: 'loc-1', name: 'Sharjah City Centre', is_active: true } as never,
  drivers: [],
  payments: [{ id: 'pay-e16f5dc3', booking_id: 'bk-e16f5dc3', amount: 952, currency: 'AED', status: 'pending', provider: 'test', provider_reference: null, paid_at: null, created_at: '' } as never],
} as unknown as AdminBookingWithDetails

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/bookings/bk-e16f5dc3']}>
      <Routes>
        <Route path="/admin/bookings/:id" element={<BookingDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BookingDetailPage — manual payment confirmation (checkout resume-payment brief)', () => {
  beforeEach(() => {
    fetchBookingByIdMock.mockReset()
    adminConfirmBookingPaymentMock.mockReset()
    adminCancelBookingMock.mockReset()
    adminStartRentalMock.mockReset()
    adminMarkReturnedMock.mockReset()
    mockAdminRole = 'super_admin'
  })

  it('shows "Confirm payment received" for a Super Admin on a pending_payment booking with an unpaid payment', async () => {
    fetchBookingByIdMock.mockResolvedValue(pendingBooking)
    renderPage()

    expect(await screen.findByRole('button', { name: /confirm payment received/i })).toBeInTheDocument()
  })

  it('shows a staff-hint instead of the action for a non-super_admin', async () => {
    mockAdminRole = 'staff'
    fetchBookingByIdMock.mockResolvedValue(pendingBooking)
    renderPage()

    await screen.findByText(/only a super admin can confirm this payment manually/i)
    expect(screen.queryByRole('button', { name: /confirm payment received/i })).not.toBeInTheDocument()
  })

  it('does not show the action once the booking is already confirmed', async () => {
    fetchBookingByIdMock.mockResolvedValue({
      ...pendingBooking,
      status: 'confirmed',
      payments: [{ ...pendingBooking.payments[0], status: 'paid' }],
    })
    renderPage()

    await screen.findByText('bk-e16f5dc3') // the booking reference — confirms the page finished loading
    expect(screen.queryByRole('button', { name: /confirm payment received/i })).not.toBeInTheDocument()
  })

  it('calls admin_confirm_booking_payment and reloads the booking on confirm', async () => {
    fetchBookingByIdMock.mockResolvedValueOnce(pendingBooking).mockResolvedValueOnce({
      ...pendingBooking,
      status: 'confirmed',
      payments: [{ ...pendingBooking.payments[0], status: 'paid' }],
    })
    adminConfirmBookingPaymentMock.mockResolvedValue(undefined)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /confirm payment received/i }))
    fireEvent.click(await screen.findByRole('button', { name: /yes, confirm/i }))

    await waitFor(() => expect(adminConfirmBookingPaymentMock).toHaveBeenCalledWith('bk-e16f5dc3', ''))
    await waitFor(() => expect(fetchBookingByIdMock).toHaveBeenCalledTimes(2))
  })
})

describe('BookingDetailPage — Phase 11 controlled booking actions (replaces the unrestricted status dropdown)', () => {
  beforeEach(() => {
    fetchBookingByIdMock.mockReset()
    adminConfirmBookingPaymentMock.mockReset()
    adminCancelBookingMock.mockReset()
    adminStartRentalMock.mockReset()
    adminMarkReturnedMock.mockReset()
    mockAdminRole = 'super_admin'
  })

  it('never renders a status <select> — every transition is a named, controlled action', async () => {
    fetchBookingByIdMock.mockResolvedValue(pendingBooking)
    renderPage()
    await screen.findByText('bk-e16f5dc3')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('offers Confirm Payment Received and Cancel Booking for a pending_payment booking, but not Start Rental or Mark Returned', async () => {
    fetchBookingByIdMock.mockResolvedValue(pendingBooking)
    renderPage()

    expect(await screen.findByRole('button', { name: /confirm payment received/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel booking/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start rental/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark returned/i })).not.toBeInTheDocument()
  })

  it('offers Start Rental and Cancel Booking for a confirmed booking, but not Confirm Payment Received or Mark Returned', async () => {
    fetchBookingByIdMock.mockResolvedValue({
      ...pendingBooking,
      status: 'confirmed',
      payments: [{ ...pendingBooking.payments[0], status: 'paid' }],
    })
    renderPage()

    expect(await screen.findByRole('button', { name: /start rental/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel booking/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirm payment received/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark returned/i })).not.toBeInTheDocument()
  })

  it('offers only Mark Returned for an active booking — no Cancel Booking action', async () => {
    fetchBookingByIdMock.mockResolvedValue({
      ...pendingBooking,
      status: 'active',
      payments: [{ ...pendingBooking.payments[0], status: 'paid' }],
    })
    renderPage()

    expect(await screen.findByRole('button', { name: /mark returned/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start rental/i })).not.toBeInTheDocument()
  })

  it('offers no actions at all for a terminal (completed) booking', async () => {
    fetchBookingByIdMock.mockResolvedValue({
      ...pendingBooking,
      status: 'completed',
      payments: [{ ...pendingBooking.payments[0], status: 'paid' }],
    })
    renderPage()

    await screen.findByText(/no manual actions are available/i)
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start rental/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark returned/i })).not.toBeInTheDocument()
  })

  it('shows staff-hints instead of action buttons for a non-super_admin', async () => {
    mockAdminRole = 'staff'
    fetchBookingByIdMock.mockResolvedValue(pendingBooking)
    renderPage()

    await screen.findByText(/only a super admin can cancel a booking/i)
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirm payment received/i })).not.toBeInTheDocument()
  })

  it('calls admin_cancel_booking and reloads the booking on confirm', async () => {
    fetchBookingByIdMock.mockResolvedValueOnce(pendingBooking).mockResolvedValueOnce({ ...pendingBooking, status: 'cancelled' })
    adminCancelBookingMock.mockResolvedValue(undefined)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /cancel booking/i }))
    fireEvent.click(await screen.findByRole('button', { name: /yes, cancel booking/i }))

    await waitFor(() => expect(adminCancelBookingMock).toHaveBeenCalledWith('bk-e16f5dc3', ''))
    await waitFor(() => expect(fetchBookingByIdMock).toHaveBeenCalledTimes(2))
  })

  it('calls admin_start_rental and reloads the booking on confirm', async () => {
    const confirmedBooking = { ...pendingBooking, status: 'confirmed' as const, payments: [{ ...pendingBooking.payments[0], status: 'paid' as const }] }
    fetchBookingByIdMock.mockResolvedValueOnce(confirmedBooking).mockResolvedValueOnce({ ...confirmedBooking, status: 'active' })
    adminStartRentalMock.mockResolvedValue(undefined)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /start rental/i }))
    fireEvent.click(await screen.findByRole('button', { name: /yes, start rental/i }))

    await waitFor(() => expect(adminStartRentalMock).toHaveBeenCalledWith('bk-e16f5dc3', ''))
    await waitFor(() => expect(fetchBookingByIdMock).toHaveBeenCalledTimes(2))
  })

  it('calls admin_mark_returned and reloads the booking on confirm', async () => {
    const activeBooking = { ...pendingBooking, status: 'active' as const, payments: [{ ...pendingBooking.payments[0], status: 'paid' as const }] }
    fetchBookingByIdMock.mockResolvedValueOnce(activeBooking).mockResolvedValueOnce({ ...activeBooking, status: 'completed' })
    adminMarkReturnedMock.mockResolvedValue(undefined)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /mark returned/i }))
    fireEvent.click(await screen.findByRole('button', { name: /yes, mark returned/i }))

    await waitFor(() => expect(adminMarkReturnedMock).toHaveBeenCalledWith('bk-e16f5dc3', ''))
    await waitFor(() => expect(fetchBookingByIdMock).toHaveBeenCalledTimes(2))
  })

  it('shows an inline error and does not reload the booking when the cancel RPC is rejected (e.g. staff bypassing the UI)', async () => {
    fetchBookingByIdMock.mockResolvedValue(pendingBooking)
    adminCancelBookingMock.mockRejectedValue(new Error('Only a Super Admin can cancel a booking.'))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /cancel booking/i }))
    fireEvent.click(await screen.findByRole('button', { name: /yes, cancel booking/i }))

    await screen.findByText('Only a Super Admin can cancel a booking.')
    expect(fetchBookingByIdMock).toHaveBeenCalledTimes(1)
  })
})
