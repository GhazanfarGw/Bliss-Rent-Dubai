import { describe, it, expect, vi } from 'vitest'
import { sendViaResend, type FetchLike } from './resendProvider.ts'

const config = { apiKey: 'test-key', fromAddress: 'Bliss Rent <noreply@bliss.rent>' }
const params = { to: 'customer@example.com', subject: 'Booking confirmed', html: '<p>Hi</p>' }

function fakeFetch(response: Partial<Response> & { json?: () => Promise<unknown>; text?: () => Promise<string> }): FetchLike {
  return vi.fn(async () => response as Response)
}

describe('sendViaResend', () => {
  it('posts to the Resend API with the bearer token and JSON body', async () => {
    const fetchImpl = fakeFetch({ ok: true, status: 200, json: async () => ({ id: 'msg-123' }) })
    await sendViaResend(config, params, fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    )
    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(call[1].body as string)
    expect(body).toEqual({ from: config.fromAddress, to: params.to, subject: params.subject, html: params.html })
  })

  it('returns ok:true with the provider message id on success', async () => {
    const fetchImpl = fakeFetch({ ok: true, status: 200, json: async () => ({ id: 'msg-123' }) })
    const result = await sendViaResend(config, params, fetchImpl)
    expect(result).toEqual({ ok: true, providerMessageId: 'msg-123' })
  })

  it('returns ok:false with the status and body text on an HTTP error', async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 422, text: async () => 'invalid "to" address' })
    const result = await sendViaResend(config, params, fetchImpl)
    expect(result.ok).toBe(false)
    expect(result.errorMessage).toContain('422')
    expect(result.errorMessage).toContain('invalid "to" address')
  })

  it('returns ok:false when fetch itself throws (network failure)', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new Error('network down')
    })
    const result = await sendViaResend(config, params, fetchImpl)
    expect(result).toEqual({ ok: false, errorMessage: 'network down' })
  })

  it('refuses to call the network at all when the API key is missing', async () => {
    const fetchImpl = fakeFetch({ ok: true, status: 200, json: async () => ({ id: 'x' }) })
    const result = await sendViaResend({ apiKey: '', fromAddress: config.fromAddress }, params, fetchImpl)
    expect(result.ok).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('includes reply_to when replyTo is set on the config', async () => {
    const fetchImpl = fakeFetch({ ok: true, status: 200, json: async () => ({ id: 'msg-123' }) })
    await sendViaResend({ ...config, replyTo: 'support@bliss.rent' }, params, fetchImpl)
    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(call[1].body as string)
    expect(body.reply_to).toEqual(['support@bliss.rent'])
  })

  it('omits reply_to entirely when replyTo is not set (unchanged wire format)', async () => {
    const fetchImpl = fakeFetch({ ok: true, status: 200, json: async () => ({ id: 'msg-123' }) })
    await sendViaResend(config, params, fetchImpl)
    const call = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(call[1].body as string)
    expect(body).not.toHaveProperty('reply_to')
  })
})
