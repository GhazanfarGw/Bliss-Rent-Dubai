import { describe, it, expect, vi } from 'vitest'
import { handleSubmitExtensionRequest, type SupabaseLike } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    bookingReference: 'BLS-ABCDEF12',
    vehicleNumber: 'ABC-123',
    requestedReturnDate: '2026-09-10',
    ...overrides,
  }
}

function fakeSupabase(opts: { rpcData?: Record<string, unknown>[]; rpcError?: { code?: string; message: string } }): SupabaseLike {
  return {
    rpc: vi.fn(async () => ({ data: opts.rpcData ?? null, error: opts.rpcError ?? null })),
  }
}

describe('handleSubmitExtensionRequest', () => {
  it('submits a valid request and returns the requested (unprocessed) status', async () => {
    const supabase = fakeSupabase({ rpcData: [{ extension_id: 'ext-1', status: 'requested', is_late: false }] })
    const result = await handleSubmitExtensionRequest(baseRequest(), supabase)
    expect(result).toEqual({ extensionId: 'ext-1', status: 'requested', isLate: false })
    expect(supabase.rpc).toHaveBeenCalledWith('submit_extension_request_public', {
      p_booking_reference: 'BLS-ABCDEF12',
      p_vehicle_number: 'ABC-123',
      p_requested_return_date: '2026-09-10',
    })
  })

  it('flags a late request without rejecting it — no advance-request-window check', async () => {
    const supabase = fakeSupabase({ rpcData: [{ extension_id: 'ext-2', status: 'requested', is_late: true }] })
    const result = await handleSubmitExtensionRequest(baseRequest({ requestedReturnDate: '2026-09-10' }), supabase)
    expect(result.isLate).toBe(true)
    expect(result.status).toBe('requested')
  })

  it('rejects a missing booking reference before ever touching the database', async () => {
    const supabase = fakeSupabase({})
    const err = await handleSubmitExtensionRequest(baseRequest({ bookingReference: '' }), supabase).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.fieldErrors).toHaveProperty('bookingReference')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects a missing vehicle number before ever touching the database', async () => {
    const supabase = fakeSupabase({})
    const err = await handleSubmitExtensionRequest(baseRequest({ vehicleNumber: '' }), supabase).catch((e) => e)
    expect(err.fieldErrors).toHaveProperty('vehicleNumber')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects an invalid return date before ever touching the database', async () => {
    const supabase = fakeSupabase({})
    const err = await handleSubmitExtensionRequest(baseRequest({ requestedReturnDate: 'not-a-date' }), supabase).catch((e) => e)
    expect(err.fieldErrors).toHaveProperty('requestedReturnDate')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('passes through the database verification-failure message verbatim, without distinguishing which field was wrong', async () => {
    const supabase = fakeSupabase({
      rpcError: { message: 'We could not verify that booking reference and vehicle number together. Please double-check both and try again.' },
    })
    const err = await handleSubmitExtensionRequest(baseRequest({ vehicleNumber: 'WRONG-999' }), supabase).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.message).toMatch(/could not verify that booking reference and vehicle number together/i)
  })

  it('passes through a "cannot be extended" / out-of-bound business message from the database', async () => {
    const supabase = fakeSupabase({ rpcError: { message: 'Extension length must be between 1 and 30 days (requested 45).' } })
    const err = await handleSubmitExtensionRequest(baseRequest(), supabase).catch((e) => e)
    expect(err.message).toMatch(/between 1 and 30 days/)
  })

  it('reports SERVER_ERROR when the RPC returns no row at all', async () => {
    const supabase = fakeSupabase({ rpcData: [] })
    const err = await handleSubmitExtensionRequest(baseRequest(), supabase).catch((e) => e)
    expect(err.code).toBe('SERVER_ERROR')
  })
})
