import { describe, it, expect, vi } from 'vitest'
import { handleSubmitComplaint, type SupabaseLike } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Jane Renter',
    email: 'jane@example.com',
    subject: 'Late refund',
    message: 'My refund has not arrived yet.',
    ...overrides,
  }
}

function fakeSupabase(opts: { rpcData?: Record<string, unknown>[]; rpcError?: { code?: string; message: string } }): SupabaseLike {
  return {
    rpc: vi.fn(async () => ({ data: opts.rpcData ?? null, error: opts.rpcError ?? null })),
  }
}

describe('handleSubmitComplaint', () => {
  it('submits a valid message and returns the open status', async () => {
    const supabase = fakeSupabase({ rpcData: [{ complaint_id: 'c1', status: 'open' }] })
    const result = await handleSubmitComplaint(baseRequest(), supabase)
    expect(result).toEqual({ complaintId: 'c1', status: 'open' })
    expect(supabase.rpc).toHaveBeenCalledWith('submit_complaint_public', {
      p_customer_full_name: 'Jane Renter',
      p_customer_email: 'jane@example.com',
      p_customer_phone: null,
      p_subject: 'Late refund',
      p_description: 'My refund has not arrived yet.',
    })
  })

  it('accepts a blank subject — subject has always been optional in the form', async () => {
    const supabase = fakeSupabase({ rpcData: [{ complaint_id: 'c2', status: 'open' }] })
    await handleSubmitComplaint(baseRequest({ subject: '' }), supabase)
    expect(supabase.rpc).toHaveBeenCalledWith('submit_complaint_public', expect.objectContaining({ p_subject: null }))
  })

  it('passes phone through when provided', async () => {
    const supabase = fakeSupabase({ rpcData: [{ complaint_id: 'c3', status: 'open' }] })
    await handleSubmitComplaint(baseRequest({ phone: '+971500000000' }), supabase)
    expect(supabase.rpc).toHaveBeenCalledWith('submit_complaint_public', expect.objectContaining({ p_customer_phone: '+971500000000' }))
  })

  it('rejects a missing name before ever touching the database', async () => {
    const supabase = fakeSupabase({})
    await expect(handleSubmitComplaint(baseRequest({ fullName: '' }), supabase)).rejects.toThrow(ApiError)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects an invalid email', async () => {
    const supabase = fakeSupabase({})
    await expect(handleSubmitComplaint(baseRequest({ email: 'not-an-email' }), supabase)).rejects.toThrow(ApiError)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects an empty message', async () => {
    const supabase = fakeSupabase({})
    await expect(handleSubmitComplaint(baseRequest({ message: '   ' }), supabase)).rejects.toThrow(ApiError)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('maps a database error to a 422 with a customer-safe message', async () => {
    const supabase = fakeSupabase({ rpcError: { message: 'Please enter a valid email address.' } })
    await expect(handleSubmitComplaint(baseRequest(), supabase)).rejects.toThrow('Please enter a valid email address.')
  })

  it('raises a server error when the RPC returns no row', async () => {
    const supabase = fakeSupabase({ rpcData: [] })
    await expect(handleSubmitComplaint(baseRequest(), supabase)).rejects.toThrow(ApiError)
  })
})
