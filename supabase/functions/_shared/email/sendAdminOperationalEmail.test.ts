import { describe, it, expect, vi } from 'vitest'
import { sendAdminOperationalEmailIdempotently, type AdminEmailLogStore, type AdminEmailLogInsertRow } from './sendAdminOperationalEmail.ts'
import type { BookingSummary } from './types.ts'
import type { AdminRecipient } from './adminRecipients.ts'

const summary: BookingSummary = {
  reference: 'BLS-D300AC89',
  vehicleName: 'Toyota Camry',
  rentalDatesLabel: '2026-09-10 → 2026-09-15',
  pickupLabel: 'DXB Terminal 3',
  dropoffLabel: 'DXB Terminal 3',
  amountLabel: 'AED 750',
}

const recipient: AdminRecipient = { id: 'admin-1', name: 'Aisha Owner', email: 'owner@example.com' }

const baseParams = {
  eventType: 'admin_booking_confirmed' as const,
  bookingId: 'd300ac89-03b4-4f51-93b9-49b7c3f235d7',
  customerName: 'Jane Renter',
  summary,
  recipient,
  language: 'en' as const,
  siteBaseUrl: 'https://bliss.rent',
  dashboardPath: '/admin/bookings/d300ac89-03b4-4f51-93b9-49b7c3f235d7',
}

const resendConfig = { apiKey: 'test-key', fromAddress: 'Bliss Rent <noreply@bliss.rent>' }

function createFakeAdminEmailLogStore() {
  const seen = new Map<string, string>()
  let nextId = 1
  const sentIds: string[] = []
  const failedIds: { id: string; reason: string }[] = []
  const rows: AdminEmailLogInsertRow[] = []

  const store: AdminEmailLogStore = {
    async insertIfNew(row) {
      rows.push(row)
      if (seen.has(row.idempotency_key)) {
        return { inserted: false, id: null }
      }
      const id = `log-${nextId++}`
      seen.set(row.idempotency_key, id)
      return { inserted: true, id }
    },
    async markSent(id) {
      sentIds.push(id)
    },
    async markFailed(id, reason) {
      failedIds.push({ id, reason })
    },
  }

  return { store, sentIds, failedIds, rows }
}

describe('sendAdminOperationalEmailIdempotently', () => {
  it('sends once and records an email_log row with recipient_type admin', async () => {
    const { store, sentIds, rows } = createFakeAdminEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcome = await sendAdminOperationalEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)

    expect(outcome).toEqual({ status: 'sent', emailLogId: 'log-1', providerMessageId: 'msg-1' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sentIds).toEqual(['log-1'])
    expect(rows[0].recipient_type).toBe('admin')
    expect(rows[0].recipient_email).toBe('owner@example.com')
  })

  it('folds the recipient admin id into the idempotency key, not just the booking and event', async () => {
    const { rows } = await (async () => {
      const { store, rows } = createFakeAdminEmailLogStore()
      const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
      await sendAdminOperationalEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)
      return { rows }
    })()
    expect(rows[0].idempotency_key).toBe(
      'booking:d300ac89-03b4-4f51-93b9-49b7c3f235d7:admin_booking_confirmed:admin-1',
    )
  })

  it('sends independently to two different admins for the same booking/event (distinct keys, both delivered)', async () => {
    const { store, rows } = createFakeAdminEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const deps = { emailLog: store, resendConfig, sendEmail }
    const otherAdmin: AdminRecipient = { id: 'admin-2', name: 'Karim Staff', email: 'staff@example.com' }

    const first = await sendAdminOperationalEmailIdempotently(deps, baseParams)
    const second = await sendAdminOperationalEmailIdempotently(deps, { ...baseParams, recipient: otherAdmin })

    expect(first.status).toBe('sent')
    expect(second.status).toBe('sent')
    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(rows.map((r) => r.idempotency_key)).toEqual([
      'booking:d300ac89-03b4-4f51-93b9-49b7c3f235d7:admin_booking_confirmed:admin-1',
      'booking:d300ac89-03b4-4f51-93b9-49b7c3f235d7:admin_booking_confirmed:admin-2',
    ])
  })

  it('is a no-op on a retried send to the SAME admin for the SAME event', async () => {
    const { store } = createFakeAdminEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const deps = { emailLog: store, resendConfig, sendEmail }

    const first = await sendAdminOperationalEmailIdempotently(deps, baseParams)
    const second = await sendAdminOperationalEmailIdempotently(deps, baseParams)

    expect(first.status).toBe('sent')
    expect(second).toEqual({ status: 'skipped_duplicate' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('protects two concurrent sends to the same admin for the same event from racing (no select-then-insert gap)', async () => {
    const { store } = createFakeAdminEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const deps = { emailLog: store, resendConfig, sendEmail }

    const [a, b] = await Promise.all([
      sendAdminOperationalEmailIdempotently(deps, baseParams),
      sendAdminOperationalEmailIdempotently(deps, baseParams),
    ])

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual(['sent', 'skipped_duplicate'])
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('folds in triggeringRowId ahead of the recipient id for a repeatable event (e.g. a second extension request on the same booking)', async () => {
    const { store, rows } = createFakeAdminEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const deps = { emailLog: store, resendConfig, sendEmail }
    const params = { ...baseParams, eventType: 'admin_extension_requested' as const, dashboardPath: '/admin/extensions' }

    const firstRequest = await sendAdminOperationalEmailIdempotently(deps, { ...params, triggeringRowId: 'ext-1' })
    const secondRequest = await sendAdminOperationalEmailIdempotently(deps, { ...params, triggeringRowId: 'ext-2' })
    const retryOfFirst = await sendAdminOperationalEmailIdempotently(deps, { ...params, triggeringRowId: 'ext-1' })

    expect(firstRequest.status).toBe('sent')
    expect(secondRequest.status).toBe('sent')
    expect(retryOfFirst).toEqual({ status: 'skipped_duplicate' })
    expect(rows.map((r) => r.idempotency_key)).toEqual([
      'booking:d300ac89-03b4-4f51-93b9-49b7c3f235d7:admin_extension_requested:ext-1:admin-1',
      'booking:d300ac89-03b4-4f51-93b9-49b7c3f235d7:admin_extension_requested:ext-2:admin-1',
      'booking:d300ac89-03b4-4f51-93b9-49b7c3f235d7:admin_extension_requested:ext-1:admin-1',
    ])
  })

  it('records a send failure and does not throw', async () => {
    const { store, failedIds } = createFakeAdminEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: false, errorMessage: 'Resend API error 500' }))

    const outcome = await sendAdminOperationalEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)

    expect(outcome).toEqual({ status: 'send_failed', emailLogId: 'log-1', errorMessage: 'Resend API error 500' })
    expect(failedIds).toEqual([{ id: 'log-1', reason: 'Resend API error 500' }])
  })

  it('renders Arabic/RTL HTML when language is ar', async () => {
    const { store } = createFakeAdminEmailLogStore()
    let capturedHtml = ''
    const sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })

    await sendAdminOperationalEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, { ...baseParams, language: 'ar' })

    expect(capturedHtml).toContain('dir="rtl"')
  })

  it('HTML-escapes a hostile customer name', async () => {
    const { store } = createFakeAdminEmailLogStore()
    let capturedHtml = ''
    const sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })

    await sendAdminOperationalEmailIdempotently(
      { emailLog: store, resendConfig, sendEmail },
      { ...baseParams, customerName: '<img src=x onerror=alert(1)>' },
    )

    expect(capturedHtml).not.toContain('<img')
  })

  it('renders the required-action banner only when the event content sets one', async () => {
    const { store } = createFakeAdminEmailLogStore()
    let capturedHtml = ''
    const sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })

    await sendAdminOperationalEmailIdempotently(
      { emailLog: store, resendConfig, sendEmail },
      { ...baseParams, eventType: 'admin_payment_failed', dashboardPath: '/admin/bookings/d300ac89-03b4-4f51-93b9-49b7c3f235d7' },
    )

    expect(capturedHtml).toContain('Follow up with the customer')
  })

  it('sends to the resolved admin recipient address', async () => {
    const { store } = createFakeAdminEmailLogStore()
    let capturedTo = ''
    const sendEmail = vi.fn(async (_config, params: { to: string }) => {
      capturedTo = params.to
      return { ok: true, providerMessageId: 'msg-1' }
    })

    await sendAdminOperationalEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)

    expect(capturedTo).toBe('owner@example.com')
  })

  it('includes the admin dashboard CTA link for the given dashboardPath', async () => {
    const { store } = createFakeAdminEmailLogStore()
    let capturedHtml = ''
    const sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })

    await sendAdminOperationalEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)

    expect(capturedHtml).toContain('https://bliss.rent/admin/bookings/d300ac89-03b4-4f51-93b9-49b7c3f235d7')
  })
})
