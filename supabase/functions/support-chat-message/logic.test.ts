import { describe, it, expect, vi } from 'vitest'
import { handleSupportChatMessage, type SupabaseLike } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    accessToken: 'tok-123',
    message: 'Any update on this?',
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

describe('handleSupportChatMessage', () => {
  it('posts a follow-up message with the access token', async () => {
    const supabase = fakeSupabase({ rpcData: [{ message_id: 'm1', created_at: '2026-09-13T10:00:00Z' }] })
    const result = await handleSupportChatMessage(baseRequest(), supabase)
    expect(result).toEqual({ messageId: 'm1', createdAt: '2026-09-13T10:00:00Z' })
    expect(supabase.rpc).toHaveBeenCalledWith('post_support_chat_message_public', {
      p_access_token: 'tok-123',
      p_message: 'Any update on this?',
      p_image_path: null,
    })
  })

  it('uploads a photo first and passes its storage path to the RPC', async () => {
    const supabase = fakeSupabase({ rpcData: [{ message_id: 'm2', created_at: '2026-09-13T10:05:00Z' }] })
    const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    await handleSupportChatMessage(baseRequest({ message: '', imageBase64: tinyPngBase64, imageMimeType: 'image/jpeg' }), supabase)
    const [path] = (supabase.uploadImage as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(path).toMatch(/\.jpg$/)
    expect(supabase.rpc).toHaveBeenCalledWith('post_support_chat_message_public', expect.objectContaining({ p_image_path: path }))
  })

  it('rejects a missing access token before ever touching the database', async () => {
    const supabase = fakeSupabase({})
    await expect(handleSupportChatMessage(baseRequest({ accessToken: '' }), supabase)).rejects.toThrow(ApiError)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('rejects an empty message with no photo either', async () => {
    const supabase = fakeSupabase({})
    await expect(handleSupportChatMessage(baseRequest({ message: '   ' }), supabase)).rejects.toThrow(ApiError)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('maps a "conversation not found" database error to a customer-safe message', async () => {
    const supabase = fakeSupabase({ rpcError: { message: 'This conversation could not be found. Please start a new chat.' } })
    await expect(handleSupportChatMessage(baseRequest(), supabase)).rejects.toThrow('This conversation could not be found. Please start a new chat.')
  })

  it('raises a server error when the RPC returns no row', async () => {
    const supabase = fakeSupabase({ rpcData: [] })
    await expect(handleSupportChatMessage(baseRequest(), supabase)).rejects.toThrow(ApiError)
  })
})
