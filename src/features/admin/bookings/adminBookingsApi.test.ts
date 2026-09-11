import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chainable } from '@/test/supabaseMock'

const fromMock = vi.fn()
const storageFromMock = vi.fn()
const functionsInvokeMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    storage: { from: (...args: unknown[]) => storageFromMock(...args) },
    functions: { invoke: (...args: unknown[]) => functionsInvokeMock(...args) },
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

const {
  fetchBookings,
  fetchBookingById,
  adminCancelBooking,
  adminStartRental,
  adminMarkReturned,
  adminConfirmBookingVehicle,
  fetchDriverDocumentUrl,
} = await import('./adminBookingsApi')

describe('adminBookingsApi', () => {
  beforeEach(() => {
    fromMock.mockReset()
    storageFromMock.mockReset()
    functionsInvokeMock.mockReset()
    rpcMock.mockReset()
    functionsInvokeMock.mockResolvedValue({ data: null, error: null })
    rpcMock.mockResolvedValue({ data: null, error: null })
  })

  it('lists bookings for the requested status (Booking Management)', async () => {
    const rows = [{ id: 'b1', status: 'confirmed' }, { id: 'b2', status: 'confirmed' }]
    fromMock.mockReturnValue(chainable({ data: rows }))

    const result = await fetchBookings('confirmed')

    expect(fromMock).toHaveBeenCalledWith('bookings')
    expect(result).toHaveLength(2)
  })

  it('returns null when a booking id does not exist, instead of throwing (Booking Detail)', async () => {
    fromMock.mockReturnValue(chainable({ data: null }))
    const result = await fetchBookingById('does-not-exist')
    expect(result).toBeNull()
  })

  it('fetches a single booking with its joined details (Booking Detail)', async () => {
    const row = { id: 'b1', status: 'active', customers: { full_name: 'Jane' } }
    fromMock.mockReturnValue(chainable({ data: row }))
    const result = await fetchBookingById('b1')
    expect(result?.id).toBe('b1')
  })

  it('raises AdminApiError instead of a bare Supabase error on a failed query', async () => {
    fromMock.mockReturnValue(chainable({ data: null, error: { message: 'permission denied' } }))
    await expect(fetchBookings('all')).rejects.toThrow('permission denied')
  })

  // -------------------------------------------------------------------
  // Phase 11 — every manual status transition now goes through a
  // Super-Admin-only SECURITY DEFINER RPC (never a direct `bookings`
  // UPDATE — admins lost that RLS grant in this phase), so these tests
  // assert the RPC call itself, not a `.from('bookings').update(...)`.
  // -------------------------------------------------------------------

  describe('adminCancelBooking', () => {
    it('calls the admin_cancel_booking RPC — no parallel status-mutation path', async () => {
      await expect(adminCancelBooking('b1')).resolves.toBeUndefined()
      expect(rpcMock).toHaveBeenCalledWith('admin_cancel_booking', { p_booking_id: 'b1', p_note: null })
    })

    it('passes a trimmed note through when given', async () => {
      await adminCancelBooking('b1', '  guest requested refund  ')
      expect(rpcMock).toHaveBeenCalledWith('admin_cancel_booking', { p_booking_id: 'b1', p_note: 'guest requested refund' })
    })

    it('raises AdminApiError and never calls the notification emails when the RPC itself fails', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'Only a Super Admin can cancel a booking.' } })
      await expect(adminCancelBooking('b1')).rejects.toThrow('Only a Super Admin can cancel a booking.')
      expect(functionsInvokeMock).not.toHaveBeenCalled()
    })

    it('triggers the customer cancellation email after a successful cancel (Phase 9D, preserved)', async () => {
      await adminCancelBooking('b1')
      expect(functionsInvokeMock).toHaveBeenCalledWith('send-customer-email', {
        body: { bookingId: 'b1', eventType: 'booking_cancelled' },
      })
    })

    it('also triggers the admin notification email after a successful cancel (Phase 9F, preserved)', async () => {
      await adminCancelBooking('b1')
      expect(functionsInvokeMock).toHaveBeenCalledWith('notify-admin-booking-cancelled', { body: { bookingId: 'b1' } })
    })

    it('does not throw when either notification email call fails or rejects', async () => {
      functionsInvokeMock.mockImplementation(async (fn: string) => {
        if (fn === 'send-customer-email') return { data: null, error: { message: 'function unavailable' } }
        if (fn === 'notify-admin-booking-cancelled') throw new Error('network error')
        return { data: null, error: null }
      })
      await expect(adminCancelBooking('b1')).resolves.toBeUndefined()
    })
  })

  describe('adminStartRental', () => {
    it('calls the admin_start_rental RPC and never touches the email functions', async () => {
      await expect(adminStartRental('b1')).resolves.toBeUndefined()
      expect(rpcMock).toHaveBeenCalledWith('admin_start_rental', { p_booking_id: 'b1', p_note: null })
      expect(functionsInvokeMock).not.toHaveBeenCalled()
    })

    it('raises AdminApiError for an illegal transition', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'Only a confirmed booking can start its rental (current status: pending_payment).' } })
      await expect(adminStartRental('b1')).rejects.toThrow(/only a confirmed booking/i)
    })
  })

  describe('adminMarkReturned', () => {
    it('calls the admin_mark_returned RPC and never touches the email functions', async () => {
      await expect(adminMarkReturned('b1')).resolves.toBeUndefined()
      expect(rpcMock).toHaveBeenCalledWith('admin_mark_returned', { p_booking_id: 'b1', p_note: null })
      expect(functionsInvokeMock).not.toHaveBeenCalled()
    })

    it('raises AdminApiError for an illegal transition', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'Only an active rental can be marked as returned (current status: completed).' } })
      await expect(adminMarkReturned('b1')).rejects.toThrow(/only an active rental/i)
    })
  })

  // -------------------------------------------------------------------
  // Phase 14 — admin_confirm_booking_vehicle RPC wrapper. Covers both the
  // NEW-plate (new physical vehicle, inventory +1) and EXISTING-plate
  // (repoint onto an already-real vehicle) result shapes the RPC can
  // return, plus the best-effort plate_confirmed notification dispatch.
  // -------------------------------------------------------------------

  describe('adminConfirmBookingVehicle', () => {
    it('calls the admin_confirm_booking_vehicle RPC with a trimmed plate and note', async () => {
      rpcMock.mockResolvedValue({
        data: [{ booking_id: 'b1', vehicle_id: 'v-new', plate_number: 'DXB-A-12345', is_new_physical_vehicle: true, changed: true }],
        error: null,
      })
      const result = await adminConfirmBookingVehicle('b1', '  dxb-a-12345  ', '  ready for pickup  ')
      expect(rpcMock).toHaveBeenCalledWith('admin_confirm_booking_vehicle', {
        p_booking_id: 'b1',
        p_plate_number: 'dxb-a-12345',
        p_note: 'ready for pickup',
      })
      expect(result).toEqual({
        bookingId: 'b1',
        vehicleId: 'v-new',
        plateNumber: 'DXB-A-12345',
        isNewPhysicalVehicle: true,
        changed: true,
      })
    })

    it('reports an existing-vehicle reuse result (is_new_physical_vehicle: false) without creating inventory', async () => {
      rpcMock.mockResolvedValue({
        data: [{ booking_id: 'b1', vehicle_id: 'v-existing', plate_number: 'DXB-A-99999', is_new_physical_vehicle: false, changed: true }],
        error: null,
      })
      const result = await adminConfirmBookingVehicle('b1', 'DXB-A-99999')
      expect(result.isNewPhysicalVehicle).toBe(false)
      expect(result.vehicleId).toBe('v-existing')
    })

    it('raises AdminApiError and never triggers notifications when the RPC fails (e.g. plate conflict)', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'That plate is already assigned to an overlapping booking.' } })
      await expect(adminConfirmBookingVehicle('b1', 'DXB-A-1')).rejects.toThrow(/already assigned to an overlapping booking/i)
      expect(functionsInvokeMock).not.toHaveBeenCalled()
    })

    it('raises AdminApiError when the RPC returns no row', async () => {
      rpcMock.mockResolvedValue({ data: [], error: null })
      await expect(adminConfirmBookingVehicle('b1', 'DXB-A-1')).rejects.toThrow(/no result/i)
    })

    it('triggers the plate_confirmed notification delivery after a successful confirm', async () => {
      rpcMock.mockResolvedValue({
        data: [{ booking_id: 'b1', vehicle_id: 'v1', plate_number: 'DXB-A-1', is_new_physical_vehicle: true, changed: true }],
        error: null,
      })
      await adminConfirmBookingVehicle('b1', 'DXB-A-1')
      expect(functionsInvokeMock).toHaveBeenCalledWith('deliver-plate-confirmation-notifications', { body: { bookingId: 'b1' } })
    })

    it('does not throw, and still returns the result, when the notification dispatch fails or rejects', async () => {
      rpcMock.mockResolvedValue({
        data: [{ booking_id: 'b1', vehicle_id: 'v1', plate_number: 'DXB-A-1', is_new_physical_vehicle: true, changed: true }],
        error: null,
      })
      functionsInvokeMock.mockRejectedValue(new Error('network error'))
      const result = await adminConfirmBookingVehicle('b1', 'DXB-A-1')
      expect(result.bookingId).toBe('b1')
    })
  })

  it('fetches a signed, short-lived URL for a private driver document — never a public URL', async () => {
    storageFromMock.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/license.pdf?token=abc' }, error: null }),
    })
    const url = await fetchDriverDocumentUrl('booking-1/license.pdf')
    expect(storageFromMock).toHaveBeenCalledWith('driver-documents')
    expect(url).toContain('token=')
  })
})
