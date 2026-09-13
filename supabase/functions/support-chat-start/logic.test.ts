import { describe, it, expect, vi } from 'vitest'
import { handleSupportChatStart, type SupabaseLike } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Jane Renter',
    email: 'jane@example.com',
    message: 'My booking reference is wrong.',
    ...overrides,
  }
}

function fakeSupabase(opts: {
  rpcData?: Record<string, unknown>[]
  rpcError?: { code?: string; message: string }
  uploadError?: { message: string }
}): SupabaseLike {
  return {
    rpc: vi.fn(async () => ({ data: opts.rpcData ?? null, error: opts.rpcError ?? null })),
    uploadImage: vi.fn(async () => ({ error: opts.uploadError ?? null })),
  }
}

describe('handleSupportChatStart', () => {
  it('starts a conversation and returns its access token', async () => {
    const supabase = fakeSupabase({ rpcData: [{ complaint_id: 'c1', access_token: 't1', status: 'open' }] })
    const result = await handleSupportChatStart(baseRequest(), supabase)
    expect(result).toEqual({ complaintId: 'c1', accessToken: 't1', status: 'open' })
    expect(supabase.rpc).toHaveBeenCalledWith('start_support_chat_public', {
      p_customer_full_name: 'Jane Renter',
      p_customer_email: 'jane@example.com',
      p_customer_phone: null,
      p_message: 'My booking reference is wrong.',
      p_image_path: null,
    })
    expect(supabase.uploadImage).not.toHaveBeenCalled()
  })

  it('passes phone through when provided', async () => {
    const supabase = fakeSupabase({ rpcData: [{ complaint_id: 'c2', access_token: 't2', status: 'open' }] })
    await handleSupportChatStart(baseRequest({ phone: '+971500000000' }), supabase)
    expect(supabase.rpc).toHaveBeenCalledWith('start_support_chat_public', expect.objectContaining({ p_customer_phone: '+971500000000' }))
  })

  it('uploads a valid photo first and passes its storage path to the RPC', async () => {
    const supabase = fakeSupabase({ rpcData: [{ complaint_id: 'c3', access_token: 't3', status: 'open' }] })
    const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    await handleSupportChatStart(baseRequest({ imageBase64: tinyPngBase64, imageMimeType: 'image/png' }), supabase)
    expect(supabase.uploadImage).toHaveBeenCalledTimes(1)
    const [path] = (supabase.uploadImage as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(path).toMatch(/\.png$/)
    expect(supabase.rpc).toHaveBeenCalledWith('start_support_chat_public', expect.objectContaining({ p_image_path: path }))
  })

  it('accepts a photo-only message (no text)', async () => {
    const supabase = fakeSupabase({ rpcData: [{ complaint_id: 'c4', access_token: 't4', status: 'open' }] })
    const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    await expect(
      handleSupportChatStart(baseRequest({ message: '', imageBase64: tinyPngBase64, imageMimeType: 'image/png' }), supabase),
    ).resolves.toBeDefined()
  })

  it('rejects an unsupported image type before ever touching the database', async () => {
    const supabase = fakeSupabase({})
    await expect(
      handleSupportChatStart(baseRequest({ imageBase64: 'AAAA', imageMimeType: 'image/gif' }), supabase),
    ).rejects.toThrow(ApiError)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects a missing name before ever touching the database', async () => {
    const supabase = fakeSupabase({})
    await expect(handleSupportChatStart(baseRequest({ fullName: '' }), supabase)).rejects.toThrow(ApiError)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects an invalid email', async () => {
    const supabase = fakeSupabase({})
    await expect(handleSupportChatStart(baseRequest({ email: 'not-an-email' }), supabase)).rejects.toThrow(ApiError)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects an empty message with no photo either', async () => {
    const supabase = fakeSupabase({})
    await expect(handleSupportChatStart(baseRequest({ message: '   ' }), supabase)).rejects.toThrow(ApiError)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('surfaces an upload failure as a server error without calling the RPC', async () => {
    const supabase = fakeSupabase({ uploadError: { message: 'network blip' } })
    const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    await expect(
      handleSupportChatStart(baseRequest({ imageBase64: tinyPngBase64, imageMimeType: 'image/png' }), supabase),
    ).rejects.toThrow(ApiError)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('maps a database error to a customer-safe message', async () => {
    const supabase = fakeSupabase({ rpcError: { message: 'Please enter a valid email address.' } })
    await expect(handleSupportChatStart(baseRequest(), supabase)).rejects.toThrow('Please enter a valid email address.')
  })

  it('raises a server error when the RPC returns no row', async () => {
    const supabase = fakeSupabase({ rpcData: [] })
    await expect(handleSupportChatStart(baseRequest(), supabase)).rejects.toThrow(ApiError)
  })
})
