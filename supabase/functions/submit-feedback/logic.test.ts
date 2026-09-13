import { describe, it, expect, vi } from 'vitest'
import { handleSubmitFeedback, type SupabaseLike } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    rating: 5,
    message: 'Great service!',
    pagePath: '/search',
    locale: 'en',
    ...overrides,
  }
}

function fakeSupabase(opts: { rpcData?: Record<string, unknown>[]; rpcError?: { code?: string; message: string } }): SupabaseLike {
  return {
    rpc: vi.fn(async () => ({ data: opts.rpcData ?? null, error: opts.rpcError ?? null })),
  }
}

describe('handleSubmitFeedback', () => {
  it('submits a valid rating + message', async () => {
    const supabase = fakeSupabase({ rpcData: [{ feedback_id: 'f1' }] })
    const result = await handleSubmitFeedback(baseRequest(), supabase)
    expect(result).toEqual({ feedbackId: 'f1' })
    expect(supabase.rpc).toHaveBeenCalledWith('submit_site_feedback_public', {
      p_rating: 5,
      p_message: 'Great service!',
      p_page_path: '/search',
      p_locale: 'en',
    })
  })

  it('accepts a blank message — stars alone are a valid submission', async () => {
    const supabase = fakeSupabase({ rpcData: [{ feedback_id: 'f2' }] })
    await handleSubmitFeedback(baseRequest({ message: '' }), supabase)
    expect(supabase.rpc).toHaveBeenCalledWith('submit_site_feedback_public', expect.objectContaining({ p_message: null }))
  })

  it('rejects a missing rating before ever touching the database', async () => {
    const supabase = fakeSupabase({})
    await expect(handleSubmitFeedback(baseRequest({ rating: undefined }), supabase)).rejects.toThrow(ApiError)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects a rating outside the 1-5 range', async () => {
    const supabase = fakeSupabase({})
    await expect(handleSubmitFeedback(baseRequest({ rating: 6 }), supabase)).rejects.toThrow(ApiError)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects a non-integer rating', async () => {
    const supabase = fakeSupabase({})
    await expect(handleSubmitFeedback(baseRequest({ rating: 3.5 }), supabase)).rejects.toThrow(ApiError)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('maps a database error to a 422 with a guest-safe message', async () => {
    const supabase = fakeSupabase({ rpcError: { message: 'Please choose a rating from 1 to 5 stars.' } })
    await expect(handleSubmitFeedback(baseRequest(), supabase)).rejects.toThrow('Please choose a rating from 1 to 5 stars.')
  })

  it('raises a server error when the RPC returns no row', async () => {
    const supabase = fakeSupabase({ rpcData: [] })
    await expect(handleSubmitFeedback(baseRequest(), supabase)).rejects.toThrow(ApiError)
  })
})
