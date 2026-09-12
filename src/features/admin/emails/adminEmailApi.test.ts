import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chainable } from '@/test/supabaseMock'
import { AdminApiError } from '@/features/admin/adminApi'

const fromMock = vi.fn()
const functionsInvokeMock = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    functions: { invoke: (...args: unknown[]) => functionsInvokeMock(...args) },
  },
}))

const { fetchEmailLog, fetchEmailLogEventTypes, fetchEmailPreviewCatalog, fetchEmailPreviewHtml, sendTestEmail } = await import(
  './adminEmailApi'
)

describe('adminEmailApi', () => {
  beforeEach(() => {
    fromMock.mockReset()
    functionsInvokeMock.mockReset()
  })

  describe('fetchEmailLog', () => {
    it('reads email_log with no filters', async () => {
      fromMock.mockReturnValue(chainable({ data: [{ id: 'log-1' }] }))
      const result = await fetchEmailLog()
      expect(fromMock).toHaveBeenCalledWith('email_log')
      expect(result).toEqual([{ id: 'log-1' }])
    })

    it('applies status/eventType/recipientType/language/recipientSearch filters', async () => {
      const eqCalls: [string, unknown][] = []
      let ilikeCall: [string, unknown] | null = null
      fromMock.mockImplementation(() => {
        const chain: any = {
          select: () => chain,
          order: () => chain,
          limit: () => chain,
          eq: (col: string, val: unknown) => {
            eqCalls.push([col, val])
            return chain
          },
          ilike: (col: string, val: unknown) => {
            ilikeCall = [col, val]
            return chain
          },
          then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null }),
        }
        return chain
      })

      await fetchEmailLog({
        status: 'sent',
        eventType: 'booking_confirmed',
        recipientType: 'customer',
        language: 'en',
        recipientSearch: '  Jane@Example.com  ',
      })

      expect(eqCalls).toContainEqual(['status', 'sent'])
      expect(eqCalls).toContainEqual(['event_type', 'booking_confirmed'])
      expect(eqCalls).toContainEqual(['recipient_type', 'customer'])
      expect(eqCalls).toContainEqual(['language', 'en'])
      expect(ilikeCall).toEqual(['recipient_email', '%Jane@Example.com%'])
    })

    it('throws AdminApiError on a query error', async () => {
      fromMock.mockReturnValue(chainable({ data: null, error: { message: 'boom' } }))
      await expect(fetchEmailLog()).rejects.toThrow(AdminApiError)
    })
  })

  describe('fetchEmailLogEventTypes', () => {
    it('returns the distinct, sorted set of event types currently in email_log', async () => {
      fromMock.mockReturnValue(
        chainable({ data: [{ event_type: 'booking_confirmed' }, { event_type: 'admin_booking_received' }, { event_type: 'booking_confirmed' }] }),
      )
      const result = await fetchEmailLogEventTypes()
      expect(result).toEqual(['admin_booking_received', 'booking_confirmed'])
    })
  })

  describe('fetchEmailPreviewCatalog', () => {
    it('invokes preview-send-email with mode: catalog and returns the catalog', async () => {
      functionsInvokeMock.mockResolvedValue({
        data: { mode: 'catalog', catalog: [{ category: 'customer', eventType: 'booking_confirmed', label: 'booking_confirmed' }] },
        error: null,
      })
      const result = await fetchEmailPreviewCatalog()
      expect(functionsInvokeMock).toHaveBeenCalledWith('preview-send-email', { body: { mode: 'catalog' } })
      expect(result).toHaveLength(1)
    })
  })

  describe('fetchEmailPreviewHtml', () => {
    it('invokes preview-send-email with mode: preview and the given category/eventType/language', async () => {
      functionsInvokeMock.mockResolvedValue({ data: { mode: 'preview', html: '<html>hi</html>' }, error: null })
      const html = await fetchEmailPreviewHtml('customer', 'booking_confirmed', 'en')
      expect(functionsInvokeMock).toHaveBeenCalledWith('preview-send-email', {
        body: { mode: 'preview', category: 'customer', eventType: 'booking_confirmed', language: 'en' },
      })
      expect(html).toBe('<html>hi</html>')
    })

    it('surfaces a function error as AdminApiError', async () => {
      functionsInvokeMock.mockResolvedValue({ data: null, error: new Error('function failed') })
      await expect(fetchEmailPreviewHtml('customer', 'bogus', 'en')).rejects.toThrow(AdminApiError)
    })
  })

  describe('sendTestEmail', () => {
    it('invokes preview-send-email with mode: send and the recipient', async () => {
      functionsInvokeMock.mockResolvedValue({ data: { mode: 'send', sent: true, providerMessageId: 'msg-1' }, error: null })
      const result = await sendTestEmail('complaint', 'admin_complaint_received', 'en', 'qa@bliss.rent')
      expect(functionsInvokeMock).toHaveBeenCalledWith('preview-send-email', {
        body: { mode: 'send', category: 'complaint', eventType: 'admin_complaint_received', language: 'en', recipientEmail: 'qa@bliss.rent' },
      })
      expect(result).toEqual({ mode: 'send', sent: true, providerMessageId: 'msg-1' })
    })

    it('parses a structured error body (e.g. TEST_SEND_NOT_ALLOWED) into AdminApiError', async () => {
      const response = new Response(JSON.stringify({ code: 'TEST_SEND_NOT_ALLOWED', message: 'Not on the allowlist.' }), { status: 403 })
      functionsInvokeMock.mockResolvedValue({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: response } })
      await expect(sendTestEmail('customer', 'booking_confirmed', 'en', 'stranger@example.com')).rejects.toMatchObject({
        message: 'Not on the allowlist.',
      })
    })
  })
})
