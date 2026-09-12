import { describe, it, expect, vi } from 'vitest'
import { handleSendCustomerEmail, SendCustomerEmailError, type SendCustomerEmailDeps } from './logic.ts'
import type { BookingEmailRow } from '../_shared/email/bookingEmailData.ts'

const bookingRow: BookingEmailRow = {
  id: 'd300ac89-03b4-4f51-93b9-49b7c3f235d7',
  status: 'cancelled',
  start_date: '2026-09-10',
  end_date: '2026-09-15',
  total_price: 750,
  currency: 'AED',
  customers: { full_name: 'Jane Renter', email: 'jane@example.com' },
  vehicles: { make: 'Toyota', model: 'Camry' },
  pickup_location: { name: 'DXB Terminal 3' },
  dropoff_location: { name: 'DXB Terminal 3' },
}

function fakeDeps(overrides: Partial<SendCustomerEmailDeps> = {}): SendCustomerEmailDeps {
  return {
    getCallerUserId: vi.fn(async () => 'admin-1'),
    getCallerProfile: vi.fn(async () => ({ role: 'staff', is_active: true })),
    dataSource: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: bookingRow, error: null }),
          }),
        }),
      }),
    },
    emailLog: {
      insertIfNew: vi.fn(async () => ({ inserted: true, id: 'log-1' })),
      markSent: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    },
    resendConfig: { apiKey: 'test-key', fromAddress: 'Bliss Rent <noreply@bliss.rent>' },
    siteBaseUrl: 'https://bliss.rent',
    sendEmail: vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' })),
    ...overrides,
  }
}

const VALID_BODY = { bookingId: bookingRow.id, eventType: 'booking_cancelled' as const }

describe('handleSendCustomerEmail', () => {
  it('rejects a missing Authorization header without checking anything else', async () => {
    const deps = fakeDeps()
    await expect(handleSendCustomerEmail(null, VALID_BODY, deps)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(deps.getCallerUserId).not.toHaveBeenCalled()
  })

  it('rejects an expired/invalid access token', async () => {
    const deps = fakeDeps({ getCallerUserId: vi.fn(async () => null) })
    await expect(handleSendCustomerEmail('Bearer bad-token', VALID_BODY, deps)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('rejects a caller with no admin_profiles row', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => null) })
    await expect(handleSendCustomerEmail('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a suspended admin caller', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => ({ role: 'staff', is_active: false })) })
    await expect(handleSendCustomerEmail('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a caller whose role is neither staff nor super_admin', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => ({ role: 'customer', is_active: true })) })
    await expect(handleSendCustomerEmail('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a missing bookingId', async () => {
    const deps = fakeDeps()
    await expect(handleSendCustomerEmail('Bearer t', { eventType: 'booking_cancelled' }, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { bookingId: expect.any(String) },
    })
  })

  it('rejects an eventType outside the 4 allowed customer booking events', async () => {
    const deps = fakeDeps()
    await expect(
      handleSendCustomerEmail('Bearer t', { bookingId: bookingRow.id, eventType: 'something_else' }, deps),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { eventType: expect.any(String) } })
  })

  it('defaults language to en for anything other than the literal "ar"', async () => {
    const deps = fakeDeps()
    let capturedLanguage = ''
    deps.sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedLanguage = params.html.includes('dir="rtl"') ? 'ar' : 'en'
      return { ok: true, providerMessageId: 'msg-1' }
    })
    await handleSendCustomerEmail('Bearer t', { ...VALID_BODY, language: 'fr' }, deps)
    expect(capturedLanguage).toBe('en')
  })

  it('renders Arabic when language is exactly "ar"', async () => {
    const deps = fakeDeps()
    let capturedHtml = ''
    deps.sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })
    await handleSendCustomerEmail('Bearer t', { ...VALID_BODY, language: 'ar' }, deps)
    expect(capturedHtml).toContain('dir="rtl"')
  })

  it('maps a booking-not-found data error to BOOKING_NOT_FOUND', async () => {
    const deps = fakeDeps({
      dataSource: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      },
    })
    await expect(handleSendCustomerEmail('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({
      code: 'BOOKING_NOT_FOUND',
    })
  })

  it('maps a booking with no customer email on file to SERVER_ERROR, never sending', async () => {
    const deps = fakeDeps({
      dataSource: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { ...bookingRow, customers: { full_name: 'Jane', email: null } }, error: null }),
            }),
          }),
        }),
      },
    })
    await expect(handleSendCustomerEmail('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'SERVER_ERROR' })
    expect(deps.sendEmail).not.toHaveBeenCalled()
  })

  it('sends the email and returns the sent outcome for a valid admin-triggered request', async () => {
    const deps = fakeDeps()
    const result = await handleSendCustomerEmail('Bearer t', VALID_BODY, deps)
    expect(result).toEqual({ status: 'sent', emailLogId: 'log-1' })
    expect(deps.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('resolves the recipient from the database record, never from the request body', async () => {
    const deps = fakeDeps()
    let capturedTo = ''
    deps.sendEmail = vi.fn(async (_config, params: { to: string }) => {
      capturedTo = params.to
      return { ok: true, providerMessageId: 'msg-1' }
    })
    // SendCustomerEmailRequestBody has no field a caller could even use to
    // smuggle a recipient override — this just documents that the only
    // email address ever reached is bookingRow.customers.email.
    await handleSendCustomerEmail('Bearer t', VALID_BODY, deps)
    expect(capturedTo).toBe('jane@example.com')
  })

  it('is idempotent — a second call for the same booking/event is skipped, not re-sent', async () => {
    const seen = new Map<string, string>()
    let nextId = 1
    const deps = fakeDeps({
      emailLog: {
        insertIfNew: vi.fn(async (row: { idempotency_key: string }) => {
          if (seen.has(row.idempotency_key)) return { inserted: false, id: null }
          const id = `log-${nextId++}`
          seen.set(row.idempotency_key, id)
          return { inserted: true, id }
        }),
        markSent: vi.fn(async () => undefined),
        markFailed: vi.fn(async () => undefined),
      },
    })
    const first = await handleSendCustomerEmail('Bearer t', VALID_BODY, deps)
    const second = await handleSendCustomerEmail('Bearer t', VALID_BODY, deps)
    expect(first.status).toBe('sent')
    expect(second).toEqual({ status: 'skipped_duplicate' })
    expect(deps.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('propagates a send failure as a send_failed result rather than throwing', async () => {
    const deps = fakeDeps({ sendEmail: vi.fn(async () => ({ ok: false, errorMessage: 'Resend API error 500' })) })
    const result = await handleSendCustomerEmail('Bearer t', VALID_BODY, deps)
    expect(result).toEqual({ status: 'send_failed', emailLogId: 'log-1', errorMessage: 'Resend API error 500' })
  })

  it('is an instance of SendCustomerEmailError on every rejection path', async () => {
    const deps = fakeDeps({ getCallerUserId: vi.fn(async () => null) })
    await expect(handleSendCustomerEmail('Bearer t', VALID_BODY, deps)).rejects.toBeInstanceOf(SendCustomerEmailError)
  })
})
