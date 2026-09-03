import { describe, it, expect, vi } from 'vitest'
import { handlePreviewSendEmail, PreviewSendError, type PreviewSendDeps } from './logic.ts'

function baseDeps(overrides: Partial<PreviewSendDeps> = {}): PreviewSendDeps {
  return {
    async getCallerUserId() {
      return 'admin-1'
    },
    async getCallerProfile() {
      return { role: 'staff', is_active: true }
    },
    testSendGuardConfig: { testModeRaw: 'true', allowlistRaw: 'qa@bliss.rent' },
    resendConfig: { apiKey: 'k', fromAddress: 'Bliss Rent <noreply@bliss.rent>' },
    sendEmail: vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' })),
    ...overrides,
  }
}

describe('handlePreviewSendEmail — auth', () => {
  it('rejects a missing Authorization header', async () => {
    await expect(
      handlePreviewSendEmail(null, { category: 'customer', eventType: 'booking_confirmed', language: 'en' }, baseDeps()),
    ).rejects.toThrow(PreviewSendError)
  })

  it('rejects an invalid/expired token', async () => {
    const deps = baseDeps({ async getCallerUserId() { return null } })
    await expect(
      handlePreviewSendEmail('Bearer bad', { category: 'customer', eventType: 'booking_confirmed', language: 'en' }, deps),
    ).rejects.toThrow(PreviewSendError)
  })

  it('rejects an inactive admin account', async () => {
    const deps = baseDeps({ async getCallerProfile() { return { role: 'staff', is_active: false } } })
    await expect(
      handlePreviewSendEmail('Bearer t', { category: 'customer', eventType: 'booking_confirmed', language: 'en' }, deps),
    ).rejects.toThrow(PreviewSendError)
  })

  it('rejects a caller with no admin_profiles row at all', async () => {
    const deps = baseDeps({ async getCallerProfile() { return null } })
    await expect(
      handlePreviewSendEmail('Bearer t', { category: 'customer', eventType: 'booking_confirmed', language: 'en' }, deps),
    ).rejects.toThrow(PreviewSendError)
  })

  it('allows an active staff account (not just super_admin) — this tool is not privilege-escalating', async () => {
    const result = await handlePreviewSendEmail(
      'Bearer t',
      { category: 'customer', eventType: 'booking_confirmed', language: 'en' },
      baseDeps(),
    )
    expect(result.mode).toBe('preview')
  })
})

describe('handlePreviewSendEmail — catalog mode', () => {
  it('returns the full preview catalog without requiring category/eventType/language, and never calls sendEmail', async () => {
    const sendEmail = vi.fn()
    const result = await handlePreviewSendEmail('Bearer t', { mode: 'catalog' }, baseDeps({ sendEmail }))
    expect(result.mode).toBe('catalog')
    if (result.mode === 'catalog') {
      expect(result.catalog.length).toBeGreaterThan(0)
      expect(result.catalog.some((e) => e.category === 'complaint')).toBe(true)
    }
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('still enforces admin auth for catalog mode', async () => {
    const deps = baseDeps({ async getCallerProfile() { return null } })
    await expect(handlePreviewSendEmail('Bearer t', { mode: 'catalog' }, deps)).rejects.toThrow(PreviewSendError)
  })
})

describe('handlePreviewSendEmail — validation', () => {
  it('rejects an invalid category', async () => {
    await expect(
      handlePreviewSendEmail('Bearer t', { category: 'bogus', eventType: 'x', language: 'en' }, baseDeps()),
    ).rejects.toThrow(PreviewSendError)
  })

  it('rejects an invalid language', async () => {
    await expect(
      handlePreviewSendEmail('Bearer t', { category: 'customer', eventType: 'booking_confirmed', language: 'fr' }, baseDeps()),
    ).rejects.toThrow(PreviewSendError)
  })

  it('rejects a missing eventType', async () => {
    await expect(
      handlePreviewSendEmail('Bearer t', { category: 'customer', eventType: '', language: 'en' }, baseDeps()),
    ).rejects.toThrow(PreviewSendError)
  })

  it('rejects an unknown template with UNKNOWN_TEMPLATE', async () => {
    await expect(
      handlePreviewSendEmail('Bearer t', { category: 'customer', eventType: 'not_a_real_event', language: 'en' }, baseDeps()),
    ).rejects.toMatchObject({ code: 'UNKNOWN_TEMPLATE' })
  })
})

describe('handlePreviewSendEmail — preview mode', () => {
  it('returns rendered HTML and never calls sendEmail, defaulting to preview mode when mode is omitted', async () => {
    const sendEmail = vi.fn()
    const result = await handlePreviewSendEmail(
      'Bearer t',
      { category: 'complaint', eventType: 'admin_complaint_received', language: 'en' },
      baseDeps({ sendEmail }),
    )
    expect(result).toMatchObject({ mode: 'preview' })
    if (result.mode === 'preview') {
      expect(result.html).toContain('jane@example.com')
    }
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('handlePreviewSendEmail — send mode', () => {
  it('rejects a send with no recipientEmail', async () => {
    await expect(
      handlePreviewSendEmail('Bearer t', { category: 'customer', eventType: 'booking_confirmed', language: 'en', mode: 'send' }, baseDeps()),
    ).rejects.toThrow(PreviewSendError)
  })

  it('rejects a send with a malformed recipientEmail', async () => {
    await expect(
      handlePreviewSendEmail(
        'Bearer t',
        { category: 'customer', eventType: 'booking_confirmed', language: 'en', mode: 'send', recipientEmail: 'not-an-email' },
        baseDeps(),
      ),
    ).rejects.toThrow(PreviewSendError)
  })

  it('rejects a send to a non-allowlisted recipient with TEST_SEND_NOT_ALLOWED, and never calls sendEmail', async () => {
    const sendEmail = vi.fn()
    await expect(
      handlePreviewSendEmail(
        'Bearer t',
        { category: 'customer', eventType: 'booking_confirmed', language: 'en', mode: 'send', recipientEmail: 'stranger@example.com' },
        baseDeps({ sendEmail }),
      ),
    ).rejects.toMatchObject({ code: 'TEST_SEND_NOT_ALLOWED' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('rejects a send when TEST_MODE is off even if the recipient is allowlisted', async () => {
    const sendEmail = vi.fn()
    const deps = baseDeps({ sendEmail, testSendGuardConfig: { testModeRaw: 'false', allowlistRaw: 'qa@bliss.rent' } })
    await expect(
      handlePreviewSendEmail(
        'Bearer t',
        { category: 'customer', eventType: 'booking_confirmed', language: 'en', mode: 'send', recipientEmail: 'qa@bliss.rent' },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'TEST_SEND_NOT_ALLOWED' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('sends via Resend to an allowlisted recipient when both safeguards pass', async () => {
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-42' }))
    const result = await handlePreviewSendEmail(
      'Bearer t',
      { category: 'customer', eventType: 'booking_confirmed', language: 'en', mode: 'send', recipientEmail: 'qa@bliss.rent' },
      baseDeps({ sendEmail }),
    )
    expect(result).toEqual({ mode: 'send', sent: true, providerMessageId: 'msg-42' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const [, params] = sendEmail.mock.calls[0]
    expect(params.to).toBe('qa@bliss.rent')
    expect(params.subject).toContain('[TEST SEND]')
  })

  it('surfaces a Resend failure as SEND_FAILED', async () => {
    const sendEmail = vi.fn(async () => ({ ok: false, errorMessage: 'boom' }))
    await expect(
      handlePreviewSendEmail(
        'Bearer t',
        { category: 'customer', eventType: 'booking_confirmed', language: 'en', mode: 'send', recipientEmail: 'qa@bliss.rent' },
        baseDeps({ sendEmail }),
      ),
    ).rejects.toMatchObject({ code: 'SEND_FAILED' })
  })

  it('rejects an unrecognized mode value', async () => {
    await expect(
      handlePreviewSendEmail(
        'Bearer t',
        { category: 'customer', eventType: 'booking_confirmed', language: 'en', mode: 'bogus' },
        baseDeps(),
      ),
    ).rejects.toThrow(PreviewSendError)
  })
})
