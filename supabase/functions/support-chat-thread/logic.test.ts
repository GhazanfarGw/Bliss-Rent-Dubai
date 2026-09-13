import { describe, it, expect, vi } from 'vitest'
import { handleSupportChatThread, type SupabaseLike } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'

function fakeSupabase(opts: {
  complaint?: { id: string; status: string } | null
  messages?: Array<{ id: string; sender: string; body: string | null; image_path: string | null; created_at: string }>
  signedUrl?: string | null
}): SupabaseLike {
  return {
    findComplaintByToken: vi.fn(async () => (opts.complaint === undefined ? { id: 'c1', status: 'open' } : opts.complaint)),
    listMessages: vi.fn(async () => opts.messages ?? []),
    getSignedImageUrl: vi.fn(async () => (opts.signedUrl === undefined ? 'https://signed.example/photo.jpg' : opts.signedUrl)),
  }
}

describe('handleSupportChatThread', () => {
  it('rejects a missing access token', async () => {
    const supabase = fakeSupabase({})
    await expect(handleSupportChatThread({}, supabase)).rejects.toThrow(ApiError)
    expect(supabase.findComplaintByToken).not.toHaveBeenCalled()
  })

  it('rejects an unknown access token', async () => {
    const supabase = fakeSupabase({ complaint: null })
    await expect(handleSupportChatThread({ accessToken: 'nope' }, supabase)).rejects.toThrow(ApiError)
  })

  it('returns the thread in order, text-only messages untouched', async () => {
    const supabase = fakeSupabase({
      messages: [
        { id: 'm1', sender: 'customer', body: 'Hi, need help', image_path: null, created_at: '2026-09-13T09:00:00Z' },
        { id: 'm2', sender: 'admin', body: 'Sure, what is going on?', image_path: null, created_at: '2026-09-13T09:05:00Z' },
      ],
    })
    const result = await handleSupportChatThread({ accessToken: 'tok' }, supabase)
    expect(result).toEqual({
      complaintId: 'c1',
      status: 'open',
      messages: [
        { id: 'm1', sender: 'customer', body: 'Hi, need help', imageUrl: null, createdAt: '2026-09-13T09:00:00Z' },
        { id: 'm2', sender: 'admin', body: 'Sure, what is going on?', imageUrl: null, createdAt: '2026-09-13T09:05:00Z' },
      ],
    })
    expect(supabase.getSignedImageUrl).not.toHaveBeenCalled()
  })

  it('signs a URL for every message carrying a photo', async () => {
    const supabase = fakeSupabase({
      messages: [{ id: 'm1', sender: 'customer', body: null, image_path: 'abc.jpg', created_at: '2026-09-13T09:00:00Z' }],
    })
    const result = await handleSupportChatThread({ accessToken: 'tok' }, supabase)
    expect(supabase.getSignedImageUrl).toHaveBeenCalledWith('abc.jpg')
    expect(result.messages[0].imageUrl).toBe('https://signed.example/photo.jpg')
  })

  it('falls back to a null image URL when signing fails, without failing the whole thread', async () => {
    const supabase = fakeSupabase({
      messages: [{ id: 'm1', sender: 'customer', body: null, image_path: 'abc.jpg', created_at: '2026-09-13T09:00:00Z' }],
      signedUrl: null,
    })
    const result = await handleSupportChatThread({ accessToken: 'tok' }, supabase)
    expect(result.messages[0].imageUrl).toBeNull()
  })

  it('treats any sender other than "admin" as the customer', async () => {
    const supabase = fakeSupabase({
      messages: [{ id: 'm1', sender: 'weird', body: 'hi', image_path: null, created_at: '2026-09-13T09:00:00Z' }],
    })
    const result = await handleSupportChatThread({ accessToken: 'tok' }, supabase)
    expect(result.messages[0].sender).toBe('customer')
  })
})
