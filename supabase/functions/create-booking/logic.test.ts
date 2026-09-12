import { describe, it, expect, vi } from 'vitest'
import { handleCreateBooking, type SupabaseLike } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'

const validCustomer = { fullName: 'Jane Renter', email: 'jane@example.com', phone: '+971501234567' }
const validDriver = {
  fullName: 'John Driver',
  dateOfBirth: '1990-01-01',
  licenseNumber: 'DL123456',
  licenseCountry: 'United Arab Emirates',
  licenseExpiry: '2027-01-01',
}

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    vehicleId: 'veh-1',
    startDate: '2026-09-10',
    endDate: '2026-09-15',
    pickupLocationId: 'loc-1',
    dropoffLocationId: 'loc-2',
    customer: validCustomer,
    driver: validDriver,
    ...overrides,
  }
}

/** A minimal fake satisfying SupabaseLike, with the pricing/rpc results the test wants. */
function fakeSupabase(opts: {
  pricingRows?: { term: string; list_price: number; client_price: number; currency: string }[]
  pricingError?: { message: string }
  rpcData?: Record<string, unknown>[]
  rpcError?: { code?: string; message: string }
}): SupabaseLike {
  return {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: opts.pricingRows ?? [], error: opts.pricingError ?? null }),
      }),
    }),
    rpc: vi.fn(async () => ({ data: opts.rpcData ?? null, error: opts.rpcError ?? null })),
  }
}

const dailyPricing = [{ term: 'daily', list_price: 200, client_price: 150, currency: 'AED' }]

describe('handleCreateBooking', () => {
  it('creates a booking successfully with the authoritative server-computed price', async () => {
    const supabase = fakeSupabase({
      pricingRows: dailyPricing,
      rpcData: [
        {
          booking_id: 'bk-1',
          booking_reference: 'BLS-ABCDEF12',
          customer_id: 'cust-1',
          driver_id: 'drv-1',
          payment_id: 'pay-1',
          status: 'pending_payment',
          total_price: 900,
          currency: 'AED',
        },
      ],
    })

    const result = await handleCreateBooking(baseRequest(), supabase)

    expect(result.bookingReference).toBe('BLS-ABCDEF12')
    expect(result.totalPrice).toBe(900)
    expect(result.days).toBe(6)
    // The RPC must never receive a price supplied by the caller — only
    // values this function itself computed from real pricing rows.
    expect(supabase.rpc).toHaveBeenCalledWith(
      'create_booking',
      expect.objectContaining({ p_unit_price: 150, p_total_price: 900, p_term: 'daily' }),
    )
  })

  it('rejects invalid dates before ever touching the database', async () => {
    const supabase = fakeSupabase({})
    await expect(
      handleCreateBooking(baseRequest({ startDate: '2026-09-15', endDate: '2026-09-10' }), supabase),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects an invalid customer email before touching the database', async () => {
    const supabase = fakeSupabase({})
    await expect(
      handleCreateBooking(baseRequest({ customer: { ...validCustomer, email: 'nope' } }), supabase),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects an under-age driver before touching the database', async () => {
    const supabase = fakeSupabase({})
    await expect(
      handleCreateBooking(baseRequest({ driver: { ...validDriver, dateOfBirth: '2015-01-01' } }), supabase),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('reports NO_PRICING when the vehicle has no pricing rows at all', async () => {
    const supabase = fakeSupabase({ pricingRows: [] })
    await expect(handleCreateBooking(baseRequest(), supabase)).rejects.toMatchObject({ code: 'NO_PRICING' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('maps a double-booking race (exclusion_violation) to VEHICLE_UNAVAILABLE', async () => {
    const supabase = fakeSupabase({
      pricingRows: dailyPricing,
      rpcError: { code: '23P01', message: 'conflicting key value violates exclusion constraint "bookings_no_overlap"' },
    })
    const err = await handleCreateBooking(baseRequest(), supabase).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('VEHICLE_UNAVAILABLE')
  })

  it('maps "vehicle not found" to VEHICLE_NOT_FOUND', async () => {
    const supabase = fakeSupabase({
      pricingRows: dailyPricing,
      rpcError: { message: 'vehicle not found' },
    })
    const err = await handleCreateBooking(baseRequest(), supabase).catch((e) => e)
    expect(err.code).toBe('VEHICLE_NOT_FOUND')
  })

  it('maps "vehicle is not available for booking" to VEHICLE_UNAVAILABLE', async () => {
    const supabase = fakeSupabase({
      pricingRows: dailyPricing,
      rpcError: { message: 'vehicle is not available for booking' },
    })
    const err = await handleCreateBooking(baseRequest(), supabase).catch((e) => e)
    expect(err.code).toBe('VEHICLE_UNAVAILABLE')
  })
})
