import { describe, it, expect, vi } from 'vitest'
import { handleConfirmPayment, type SupabaseLike } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'

function fakeSupabase(opts: {
  rpcData?: Record<string, unknown>[]
  rpcError?: { code?: string; message: string }
}): SupabaseLike {
  return {
    rpc: vi.fn(async () => ({ data: opts.rpcData ?? null, error: opts.rpcError ?? null })),
  }
}

describe('handleConfirmPayment', () => {
  it('confirms a successful payment (non-declined test card) and returns the confirmed booking', async () => {
    const supabase = fakeSupabase({
      rpcData: [{ payment_id: 'pay-1', booking_id: 'bk-1', payment_status: 'paid', booking_status: 'confirmed' }],
    })

    const result = await handleConfirmPayment({ paymentId: 'pay-1', cardNumber: '4242 4242 4242 4242' }, supabase)

    expect(result.paymentStatus).toBe('paid')
    expect(result.bookingStatus).toBe('confirmed')
    expect(supabase.rpc).toHaveBeenCalledWith('confirm_payment', expect.objectContaining({ p_outcome: 'paid' }))
  })

  it('fails a payment using the simulated decline test card and leaves the booking pending', async () => {
    const supabase = fakeSupabase({
      rpcData: [{ payment_id: 'pay-2', booking_id: 'bk-2', payment_status: 'failed', booking_status: 'pending_payment' }],
    })

    const result = await handleConfirmPayment({ paymentId: 'pay-2', cardNumber: '4000000000000002' }, supabase)

    expect(result.paymentStatus).toBe('failed')
    expect(result.bookingStatus).toBe('pending_payment')
    expect(supabase.rpc).toHaveBeenCalledWith('confirm_payment', expect.objectContaining({ p_outcome: 'failed' }))
  })

  it('rejects a request with no paymentId before calling the database', async () => {
    const supabase = fakeSupabase({})
    await expect(handleConfirmPayment({}, supabase)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('maps "payment not found" to PAYMENT_NOT_FOUND', async () => {
    const supabase = fakeSupabase({ rpcError: { message: 'payment not found' } })
    const err = await handleConfirmPayment({ paymentId: 'missing' }, supabase).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('PAYMENT_NOT_FOUND')
  })

  it('is idempotent from the caller\'s point of view: a duplicate submit for an already-resolved payment just returns the existing state', async () => {
    // The SQL function itself guarantees the idempotency (tested at the
    // database layer); here we confirm this layer correctly passes
    // through whatever the database reports without erroring twice.
    const supabase = fakeSupabase({
      rpcData: [{ payment_id: 'pay-3', booking_id: 'bk-3', payment_status: 'paid', booking_status: 'confirmed' }],
    })
    const first = await handleConfirmPayment({ paymentId: 'pay-3', cardNumber: '4242' }, supabase)
    const second = await handleConfirmPayment({ paymentId: 'pay-3', cardNumber: '4242' }, supabase)
    expect(first).toEqual(second)
  })
})
