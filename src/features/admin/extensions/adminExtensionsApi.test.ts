import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chainable } from '@/test/supabaseMock'
import { AdminApiError } from '@/features/admin/adminApi'

const fromMock = vi.fn()
const rpcMock = vi.fn()
const getUserMock = vi.fn()
const functionsInvokeMock = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
    functions: { invoke: (...args: unknown[]) => functionsInvokeMock(...args) },
  },
}))

const {
  fetchExtensionsForBooking,
  fetchAllExtensions,
  fetchPendingExtensionRequests,
  fetchBookingForExtension,
  fetchCurrentRentedCars,
  fetchExtensionPricingSettings,
  updateExtensionPricingSettings,
  fetchExtensionPenaltySettings,
  updateExtensionPenaltySettings,
  checkVehicleAvailabilityForExtension,
  requestBookingExtension,
  processExtensionRequest,
  rejectExtensionRequest,
  confirmExtensionPayment,
  EXTENSION_SELECT,
} = await import('./adminExtensionsApi')

const BASE_RPC_ARGS = {
  p_booking_id: 'booking-1',
  p_requested_return_date: '2026-09-05',
  p_support_confirmed_by: 'Aisha (support)',
  p_support_confirmation_note: 'Confirmed on WhatsApp 2026-09-01',
  p_payment_method: 'cash' as const,
  p_amount: 300,
  p_currency: 'AED',
  p_pricing_policy_used: 'original_rate' as const,
  p_existing_extension_id: null,
  p_penalty_amount: null,
  p_penalty_policy_used: null,
  p_penalty_rate_used: null,
}

describe('adminExtensionsApi', () => {
  beforeEach(() => {
    fromMock.mockReset()
    rpcMock.mockReset()
    getUserMock.mockReset()
    getUserMock.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    functionsInvokeMock.mockReset()
    functionsInvokeMock.mockResolvedValue({ data: null, error: null })
  })

  it('fetches extensions for one booking, newest first', async () => {
    fromMock.mockReturnValue(chainable({ data: [{ id: 'ext-1' }] }))
    const result = await fetchExtensionsForBooking('booking-1')
    expect(fromMock).toHaveBeenCalledWith('booking_extensions')
    expect(result).toEqual([{ id: 'ext-1' }])
  })

  it('fetches every extension across all bookings (global history)', async () => {
    fromMock.mockReturnValue(chainable({ data: [{ id: 'ext-1' }, { id: 'ext-2' }] }))
    const result = await fetchAllExtensions()
    expect(result).toHaveLength(2)
  })

  it('fetches only requested/conflict_unresolved rows for the admin review queue', async () => {
    fromMock.mockReturnValue(chainable({ data: [{ id: 'ext-3', status: 'requested' }] }))
    const result = await fetchPendingExtensionRequests()
    expect(fromMock).toHaveBeenCalledWith('booking_extensions')
    expect(result).toEqual([{ id: 'ext-3', status: 'requested' }])
  })

  /**
   * Regression test for the production bug reported 2026-08-29: "Could not
   * embed because more than one relationship was found for
   * 'booking_extensions' and 'bookings'". booking_extensions has TWO
   * foreign keys into bookings (booking_id AND conflict_booking_id — see
   * pg_constraint on the live project), so a bare `bookings(...)` embed is
   * ambiguous. This locks in that the select always pins the embed to the
   * extension's OWN booking via the explicit FK hint, never leaving it to
   * PostgREST to guess (and fail).
   */
  it('pins the bookings embed to booking_extensions_booking_id_fkey, never the ambiguous bare "bookings(...)"', () => {
    expect(EXTENSION_SELECT).toContain('bookings!booking_extensions_booking_id_fkey(')
    expect(EXTENSION_SELECT).not.toMatch(/[^!]bookings\(/)
  })

  /**
   * Phase 7 (direct Super Admin extension workflow) — the query behind the
   * Extensions page's "Current Rented Cars" list: only bookings that are
   * genuinely being rented today (confirmed/active status AND today falls
   * inside the booking's own start/end window), soonest-return first.
   */
  it('lists current rented cars: confirmed/active status, today within the booking window, soonest return first', async () => {
    const calls: Record<string, unknown[]> = {}
    const chain: any = {
      select: (...a: unknown[]) => {
        calls.select = a
        return chain
      },
      in: (...a: unknown[]) => {
        calls.in = a
        return chain
      },
      lte: (...a: unknown[]) => {
        calls.lte = a
        return chain
      },
      gte: (...a: unknown[]) => {
        calls.gte = a
        return chain
      },
      order: (...a: unknown[]) => {
        calls.order = a
        return chain
      },
      then: (resolve: (v: unknown) => void) => resolve({ data: [{ id: 'booking-9' }], error: null }),
    }
    fromMock.mockReturnValue(chain)

    const result = await fetchCurrentRentedCars()

    expect(fromMock).toHaveBeenCalledWith('bookings')
    expect(calls.in).toEqual(['status', ['confirmed', 'active']])
    expect(calls.lte?.[0]).toBe('start_date')
    expect(calls.gte?.[0]).toBe('end_date')
    expect(calls.order).toEqual(['end_date', { ascending: true }])
    expect(result).toEqual([{ id: 'booking-9' }])
  })

  it('shapes the booking + exact vehicle + its current pricing for the extension form', async () => {
    fromMock.mockReturnValue(
      chainable({
        data: {
          id: 'booking-1',
          end_date: '2026-09-02',
          vehicles: { id: 'vehicle-123', plate_number: 'ABC-123', pricing: [{ id: 'p1', term: 'daily', client_price: 100 }] },
        },
      }),
    )
    const result = await fetchBookingForExtension('booking-1')
    expect(result).not.toBeNull()
    expect(result?.vehicle.id).toBe('vehicle-123')
    expect(result?.vehiclePricing).toEqual([{ id: 'p1', term: 'daily', client_price: 100 }])
    expect((result!.booking as unknown as { vehicles?: unknown }).vehicles).toBeUndefined()
  })

  it('returns null when the booking has no vehicle attached', async () => {
    fromMock.mockReturnValue(chainable({ data: { id: 'booking-1', vehicles: null } }))
    const result = await fetchBookingForExtension('booking-1')
    expect(result).toBeNull()
  })

  it('reads the singleton extension pricing settings row', async () => {
    fromMock.mockReturnValue(chainable({ data: { id: 1, policy: null, custom_daily_rate: null, custom_currency: 'AED' } }))
    const result = await fetchExtensionPricingSettings()
    expect(result.policy).toBeNull()
  })

  it('updates the pricing policy, stamping who changed it', async () => {
    fromMock.mockReturnValue(chainable({ data: null, error: null }))
    await updateExtensionPricingSettings({ policy: 'custom_rate', customDailyRate: 80, customCurrency: 'AED' })
    expect(fromMock).toHaveBeenCalledWith('extension_pricing_settings')
    expect(getUserMock).toHaveBeenCalled()
  })

  it('reads the singleton extension penalty settings row — starts unset', async () => {
    fromMock.mockReturnValue(chainable({ data: { id: 1, policy: null, fixed_fee_amount: null, per_day_amount: null, percentage_rate: null, currency: 'AED' } }))
    const result = await fetchExtensionPenaltySettings()
    expect(result.policy).toBeNull()
  })

  it('updates the penalty policy, stamping who changed it', async () => {
    fromMock.mockReturnValue(chainable({ data: null, error: null }))
    await updateExtensionPenaltySettings({ policy: 'per_day', fixedFeeAmount: null, perDayAmount: 25, percentageRate: null, currency: 'AED' })
    expect(fromMock).toHaveBeenCalledWith('extension_penalty_settings')
    expect(getUserMock).toHaveBeenCalled()
  })

  it('checks availability for the exact vehicle via the read-only RPC', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null })
    const result = await checkVehicleAvailabilityForExtension('booking-1', '2026-09-05')
    expect(rpcMock).toHaveBeenCalledWith('check_vehicle_availability_for_extension', {
      p_booking_id: 'booking-1',
      p_requested_return_date: '2026-09-05',
    })
    expect(result).toBe(true)
  })

  it('reports the exact vehicle as unavailable when the RPC says so — never suggests a substitute', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null })
    const result = await checkVehicleAvailabilityForExtension('booking-1', '2026-09-05')
    expect(result).toBe(false)
  })

  it('requests a fresh (admin/WhatsApp-channel) extension, passing null for the existing-request and penalty fields', async () => {
    rpcMock.mockResolvedValue({
      data: [{ extension_id: 'ext-1', status: 'approved', payment_status: 'paid', rejection_reason: null, is_late: false, penalty_amount: null, conflict_booking_id: null, replacement_vehicle_id: null }],
      error: null,
    })
    const result = await requestBookingExtension({
      bookingId: 'booking-1',
      requestedReturnDate: '2026-09-05',
      supportConfirmedBy: 'Aisha (support)',
      supportConfirmationNote: 'Confirmed on WhatsApp 2026-09-01',
      paymentMethod: 'cash',
      amount: 300,
      currency: 'AED',
      pricingPolicyUsed: 'original_rate',
    })
    expect(rpcMock).toHaveBeenCalledWith('request_booking_extension', BASE_RPC_ARGS)
    expect(result).toEqual({
      extensionId: 'ext-1',
      status: 'approved',
      paymentStatus: 'paid',
      rejectionReason: null,
      isLate: false,
      penaltyAmount: null,
      conflictBookingId: null,
      replacementVehicleId: null,
    })
  })

  it('tolerates an older/minimal RPC response shape (no is_late/penalty/conflict fields) by defaulting them', async () => {
    rpcMock.mockResolvedValue({
      data: [{ extension_id: 'ext-1', status: 'approved', payment_status: 'paid', rejection_reason: null }],
      error: null,
    })
    const result = await requestBookingExtension({
      bookingId: 'booking-1',
      requestedReturnDate: '2026-09-05',
      supportConfirmedBy: 'Aisha (support)',
      supportConfirmationNote: null,
      paymentMethod: 'cash',
      amount: 300,
      currency: 'AED',
      pricingPolicyUsed: 'original_rate',
    })
    expect(result.isLate).toBe(false)
    expect(result.penaltyAmount).toBeNull()
  })

  it('reports a rejected extension without throwing — rejection is a normal, successful outcome', async () => {
    rpcMock.mockResolvedValue({
      data: [{ extension_id: 'ext-2', status: 'rejected', payment_status: null, rejection_reason: 'Vehicle ABC-123 is already booked for part of the requested dates. No other vehicle was substituted — extension rejected.' }],
      error: null,
    })
    const result = await requestBookingExtension({
      bookingId: 'booking-1',
      requestedReturnDate: '2026-09-05',
      supportConfirmedBy: 'Aisha (support)',
      supportConfirmationNote: null,
      paymentMethod: 'cash',
      amount: 300,
      currency: 'AED',
      pricingPolicyUsed: 'original_rate',
    })
    expect(result.status).toBe('rejected')
    expect(result.rejectionReason).toMatch(/No other vehicle was substituted/)
  })

  it('reports conflict_unresolved (no replacement vehicle found) as a normal, successful outcome — never an automatic rejection', async () => {
    rpcMock.mockResolvedValue({
      data: [{
        extension_id: 'ext-4', status: 'conflict_unresolved', payment_status: null,
        rejection_reason: 'Vehicle ABC-123 has a future booking overlapping the requested dates and no suitable replacement vehicle is currently available. This needs manual admin handling — no automatic decision was made.',
        is_late: false, penalty_amount: null, conflict_booking_id: 'booking-b', replacement_vehicle_id: null,
      }],
      error: null,
    })
    const result = await requestBookingExtension({
      bookingId: 'booking-1',
      requestedReturnDate: '2026-09-05',
      supportConfirmedBy: 'Aisha (support)',
      supportConfirmationNote: null,
      paymentMethod: 'cash',
      amount: 300,
      currency: 'AED',
      pricingPolicyUsed: 'original_rate',
    })
    expect(result.status).toBe('conflict_unresolved')
    expect(result.conflictBookingId).toBe('booking-b')
    expect(result.replacementVehicleId).toBeNull()
  })

  it('reports a resolved reassignment (conflict found, future booking moved) alongside the extension approval', async () => {
    rpcMock.mockResolvedValue({
      data: [{
        extension_id: 'ext-5', status: 'approved', payment_status: 'paid', rejection_reason: null,
        is_late: false, penalty_amount: null, conflict_booking_id: 'booking-b', replacement_vehicle_id: 'vehicle-xyz',
      }],
      error: null,
    })
    const result = await requestBookingExtension({
      bookingId: 'booking-1',
      requestedReturnDate: '2026-09-05',
      supportConfirmedBy: 'Aisha (support)',
      supportConfirmationNote: null,
      paymentMethod: 'cash',
      amount: 300,
      currency: 'AED',
      pricingPolicyUsed: 'original_rate',
    })
    expect(result.status).toBe('approved')
    expect(result.conflictBookingId).toBe('booking-b')
    expect(result.replacementVehicleId).toBe('vehicle-xyz')
  })

  it('passes the penalty fields through for a late extension, including the raw rate used (not just the computed amount)', async () => {
    rpcMock.mockResolvedValue({
      data: [{ extension_id: 'ext-6', status: 'approved', payment_status: 'paid', rejection_reason: null, is_late: true, penalty_amount: 100, conflict_booking_id: null, replacement_vehicle_id: null }],
      error: null,
    })
    const result = await requestBookingExtension({
      bookingId: 'booking-1',
      requestedReturnDate: '2026-09-05',
      supportConfirmedBy: 'Aisha (support)',
      supportConfirmationNote: null,
      paymentMethod: 'cash',
      amount: 300,
      currency: 'AED',
      pricingPolicyUsed: 'original_rate',
      penaltyAmount: 100,
      penaltyPolicyUsed: 'fixed_fee',
      penaltyRateUsed: 100,
    })
    expect(rpcMock).toHaveBeenCalledWith('request_booking_extension', {
      ...BASE_RPC_ARGS,
      p_support_confirmation_note: null,
      p_penalty_amount: 100,
      p_penalty_policy_used: 'fixed_fee',
      p_penalty_rate_used: 100,
    })
    expect(result.isLate).toBe(true)
    expect(result.penaltyAmount).toBe(100)
  })

  it('freezes the raw percentage rate onto the request (e.g. 10) separately from the computed penalty amount (e.g. AED 50) — so a later Settings change never rewrites this extension\'s history', async () => {
    rpcMock.mockResolvedValue({
      data: [{ extension_id: 'ext-9', status: 'approved', payment_status: 'paid', rejection_reason: null, is_late: true, penalty_amount: 50, conflict_booking_id: null, replacement_vehicle_id: null }],
      error: null,
    })
    await requestBookingExtension({
      bookingId: 'booking-1',
      requestedReturnDate: '2026-09-05',
      supportConfirmedBy: 'Aisha (support)',
      supportConfirmationNote: null,
      paymentMethod: 'cash',
      amount: 500,
      currency: 'AED',
      pricingPolicyUsed: 'current_rate',
      penaltyAmount: 50,
      penaltyPolicyUsed: 'percentage',
      penaltyRateUsed: 10,
    })
    expect(rpcMock).toHaveBeenCalledWith(
      'request_booking_extension',
      expect.objectContaining({ p_amount: 500, p_penalty_amount: 50, p_penalty_policy_used: 'percentage', p_penalty_rate_used: 10 }),
    )
  })

  it('reviews a customer-submitted request by passing p_existing_extension_id, with support_confirmed_by null', async () => {
    rpcMock.mockResolvedValue({
      data: [{ extension_id: 'ext-7', status: 'approved', payment_status: 'paid', rejection_reason: null, is_late: false, penalty_amount: null, conflict_booking_id: null, replacement_vehicle_id: null }],
      error: null,
    })
    const result = await processExtensionRequest('ext-7', {
      bookingId: 'booking-1',
      requestedReturnDate: '2026-09-05',
      supportConfirmedBy: null,
      supportConfirmationNote: null,
      paymentMethod: 'cash',
      amount: 300,
      currency: 'AED',
      pricingPolicyUsed: 'original_rate',
    })
    expect(rpcMock).toHaveBeenCalledWith('request_booking_extension', {
      ...BASE_RPC_ARGS,
      p_support_confirmed_by: null,
      p_support_confirmation_note: null,
      p_existing_extension_id: 'ext-7',
    })
    expect(result.extensionId).toBe('ext-7')
  })

  it('maps a double-booking race (23P01) to one clear, honest message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '23P01', message: 'conflicting key value violates exclusion constraint' } })
    await expect(
      requestBookingExtension({
        bookingId: 'booking-1',
        requestedReturnDate: '2026-09-05',
        supportConfirmedBy: 'Aisha (support)',
        supportConfirmationNote: null,
        paymentMethod: 'cash',
        amount: 300,
        currency: 'AED',
        pricingPolicyUsed: 'original_rate',
      }),
    ).rejects.toThrow(/no other vehicle was substituted/i)
  })

  it('surfaces any other database error as a plain AdminApiError', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'permission denied for table booking_extensions' } })
    await expect(
      requestBookingExtension({
        bookingId: 'booking-1',
        requestedReturnDate: '2026-09-05',
        supportConfirmedBy: 'Aisha (support)',
        supportConfirmationNote: null,
        paymentMethod: 'cash',
        amount: 300,
        currency: 'AED',
        pricingPolicyUsed: 'original_rate',
      }),
    ).rejects.toThrow(AdminApiError)
  })

  it('explicitly rejects an extension request with a reason', async () => {
    rpcMock.mockResolvedValue({ data: [{ extension_id: 'ext-8', status: 'rejected' }], error: null })
    await rejectExtensionRequest('ext-8', 'Duplicate request — already handled on WhatsApp.')
    expect(rpcMock).toHaveBeenCalledWith('reject_extension_request', {
      p_extension_id: 'ext-8',
      p_rejection_reason: 'Duplicate request — already handled on WhatsApp.',
    })
  })

  it('confirms an online extension payment', async () => {
    rpcMock.mockResolvedValue({ data: [{ extension_id: 'ext-3', status: 'approved', payment_status: 'paid' }], error: null })
    await confirmExtensionPayment('ext-3', 'paid', 'stripe_ref_123')
    expect(rpcMock).toHaveBeenCalledWith('confirm_booking_extension_payment', {
      p_extension_id: 'ext-3',
      p_outcome: 'paid',
      p_reference: 'stripe_ref_123',
    })
  })

  /**
   * Phase 9E — best-effort trigger of the deliver-extension-notifications
   * Edge Function. These lock in: which of the three RPC call sites fire
   * it, with which extensionId, that it never throws (an email problem
   * must never surface as a failure of the extension action the admin
   * just successfully completed), and that it never fires when the
   * underlying RPC itself failed.
   */
  describe('triggerExtensionNotificationEmails wiring', () => {
    it('fires after requestBookingExtension succeeds, with that request\'s own extension_id', async () => {
      rpcMock.mockResolvedValue({
        data: [{ extension_id: 'ext-1', status: 'approved', payment_status: 'paid', rejection_reason: null, is_late: false, penalty_amount: null, conflict_booking_id: null, replacement_vehicle_id: null }],
        error: null,
      })
      await requestBookingExtension({
        bookingId: 'booking-1',
        requestedReturnDate: '2026-09-05',
        supportConfirmedBy: 'Aisha (support)',
        supportConfirmationNote: null,
        paymentMethod: 'cash',
        amount: 300,
        currency: 'AED',
        pricingPolicyUsed: 'original_rate',
      })
      expect(functionsInvokeMock).toHaveBeenCalledWith('deliver-extension-notifications', { body: { extensionId: 'ext-1' } })
    })

    it('fires after processExtensionRequest (customer-review path) succeeds, with the reviewed extension\'s id', async () => {
      rpcMock.mockResolvedValue({
        data: [{ extension_id: 'ext-7', status: 'approved', payment_status: 'paid', rejection_reason: null, is_late: false, penalty_amount: null, conflict_booking_id: null, replacement_vehicle_id: null }],
        error: null,
      })
      await processExtensionRequest('ext-7', {
        bookingId: 'booking-1',
        requestedReturnDate: '2026-09-05',
        supportConfirmedBy: null,
        supportConfirmationNote: null,
        paymentMethod: 'cash',
        amount: 300,
        currency: 'AED',
        pricingPolicyUsed: 'original_rate',
      })
      expect(functionsInvokeMock).toHaveBeenCalledWith('deliver-extension-notifications', { body: { extensionId: 'ext-7' } })
    })

    it('does not fire when the request_booking_extension RPC itself errors', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'permission denied for table booking_extensions' } })
      await expect(
        requestBookingExtension({
          bookingId: 'booking-1',
          requestedReturnDate: '2026-09-05',
          supportConfirmedBy: 'Aisha (support)',
          supportConfirmationNote: null,
          paymentMethod: 'cash',
          amount: 300,
          currency: 'AED',
          pricingPolicyUsed: 'original_rate',
        }),
      ).rejects.toThrow(AdminApiError)
      expect(functionsInvokeMock).not.toHaveBeenCalled()
    })

    it('fires after rejectExtensionRequest succeeds, with that extension\'s id', async () => {
      rpcMock.mockResolvedValue({ data: [{ extension_id: 'ext-8', status: 'rejected' }], error: null })
      await rejectExtensionRequest('ext-8', 'Duplicate request — already handled on WhatsApp.')
      expect(functionsInvokeMock).toHaveBeenCalledWith('deliver-extension-notifications', { body: { extensionId: 'ext-8' } })
    })

    it('does not fire when reject_extension_request itself errors', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'permission denied' } })
      await expect(rejectExtensionRequest('ext-8', 'reason')).rejects.toThrow(AdminApiError)
      expect(functionsInvokeMock).not.toHaveBeenCalled()
    })

    it('fires after confirmExtensionPayment(..., "paid", ...) succeeds', async () => {
      rpcMock.mockResolvedValue({ data: [{ extension_id: 'ext-3', status: 'approved', payment_status: 'paid' }], error: null })
      await confirmExtensionPayment('ext-3', 'paid', 'stripe_ref_123')
      expect(functionsInvokeMock).toHaveBeenCalledWith('deliver-extension-notifications', { body: { extensionId: 'ext-3' } })
    })

    it('does NOT fire after confirmExtensionPayment(..., "failed", ...) — confirm_booking_extension_payment() never writes a booking_notifications row for a failure', async () => {
      rpcMock.mockResolvedValue({ data: [{ extension_id: 'ext-3', status: 'approved', payment_status: 'failed' }], error: null })
      await confirmExtensionPayment('ext-3', 'failed', null)
      expect(functionsInvokeMock).not.toHaveBeenCalled()
    })

    it('does not fire when confirm_booking_extension_payment itself errors', async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: 'permission denied' } })
      await expect(confirmExtensionPayment('ext-3', 'paid', null)).rejects.toThrow(AdminApiError)
      expect(functionsInvokeMock).not.toHaveBeenCalled()
    })

    it('never throws/rejects the caller\'s action when the invoke call itself returns an error', async () => {
      functionsInvokeMock.mockResolvedValue({ data: null, error: { message: 'Edge Function returned a non-2xx status code' } })
      rpcMock.mockResolvedValue({
        data: [{ extension_id: 'ext-1', status: 'approved', payment_status: 'paid', rejection_reason: null, is_late: false, penalty_amount: null, conflict_booking_id: null, replacement_vehicle_id: null }],
        error: null,
      })
      const result = await requestBookingExtension({
        bookingId: 'booking-1',
        requestedReturnDate: '2026-09-05',
        supportConfirmedBy: 'Aisha (support)',
        supportConfirmationNote: null,
        paymentMethod: 'cash',
        amount: 300,
        currency: 'AED',
        pricingPolicyUsed: 'original_rate',
      })
      expect(result.extensionId).toBe('ext-1')
    })

    it('never throws/rejects the caller\'s action when the invoke call itself rejects (network failure)', async () => {
      functionsInvokeMock.mockRejectedValue(new Error('network error'))
      rpcMock.mockResolvedValue({ data: [{ extension_id: 'ext-8', status: 'rejected' }], error: null })
      await expect(rejectExtensionRequest('ext-8', 'Duplicate request.')).resolves.toBeUndefined()
    })
  })
})
