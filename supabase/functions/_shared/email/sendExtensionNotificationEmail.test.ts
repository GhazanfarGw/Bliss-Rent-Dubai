import { describe, it, expect, vi } from 'vitest'
import { sendExtensionNotificationEmailIdempotently, type SendExtensionNotificationDeps } from './sendExtensionNotificationEmail.ts'
import type { EmailLogStore, EmailLogInsertRow } from './sendCustomerBookingEmail.ts'
import type { BookingSummary } from './types.ts'
import type { ExtensionNotificationEmailParams } from './sendExtensionNotificationEmail.ts'

const summary: BookingSummary = {
  reference: 'BLS-D300AC89',
  vehicleName: 'Toyota Camry',
  rentalDatesLabel: '2026-09-10 → 2026-09-15',
  pickupLabel: 'DXB Terminal 3',
  dropoffLabel: 'DXB Terminal 3',
  amountLabel: 'AED 750',
}

const baseParams: ExtensionNotificationEmailParams = {
  notificationId: 'notif-1',
  notificationType: 'extension_approved',
  bookingId: 'd300ac89-03b4-4f51-93b9-49b7c3f235d7',
  bookingReference: 'BLS-D300AC89',
  payload: { requested_return_date: '2026-09-20', extension_days: 5, amount: 500, currency: 'AED', penalty_amount: null },
  recipient: { name: 'Jane Renter', email: 'jane@example.com' },
  summary,
  language: 'en',
  siteBaseUrl: 'https://bliss.rent',
}

const resendConfig = { apiKey: 'test-key', fromAddress: 'Bliss Rent <noreply@bliss.rent>' }

function createFakeEmailLogStore() {
  const seen = new Map<string, string>()
  let nextId = 1
  const sentIds: string[] = []
  const failedIds: { id: string; reason: string }[] = []
  const rows: EmailLogInsertRow[] = []

  const store: EmailLogStore = {
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

describe('sendExtensionNotificationEmailIdempotently', () => {
  it('sends once and records the email_log row on success', async () => {
    const { store, sentIds, rows } = createFakeEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const deps: SendExtensionNotificationDeps = { emailLog: store, resendConfig, sendEmail }

    const outcome = await sendExtensionNotificationEmailIdempotently(deps, baseParams)

    expect(outcome).toEqual({ status: 'sent', emailLogId: 'log-1', providerMessageId: 'msg-1' })
    expect(sentIds).toEqual(['log-1'])
    expect(rows[0]).toMatchObject({
      event_type: 'extension_approved',
      recipient_email: 'jane@example.com',
      idempotency_key: `booking:${baseParams.bookingId}:extension_approved:notif-1`,
    })
  })

  it('uses the REPEATABLE idempotency key shape, keyed on the notification row id — a second notification row for the same booking/type gets its own key', async () => {
    const { store, rows } = createFakeEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const deps: SendExtensionNotificationDeps = { emailLog: store, resendConfig, sendEmail }

    await sendExtensionNotificationEmailIdempotently(deps, baseParams)
    await sendExtensionNotificationEmailIdempotently(deps, { ...baseParams, notificationId: 'notif-2' })

    expect(rows.map((r) => r.idempotency_key)).toEqual([
      `booking:${baseParams.bookingId}:extension_approved:notif-1`,
      `booking:${baseParams.bookingId}:extension_approved:notif-2`,
    ])
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })

  it('is a no-op on a second delivery attempt for the exact same notification row (retry safety)', async () => {
    const { store } = createFakeEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const deps: SendExtensionNotificationDeps = { emailLog: store, resendConfig, sendEmail }

    const first = await sendExtensionNotificationEmailIdempotently(deps, baseParams)
    const second = await sendExtensionNotificationEmailIdempotently(deps, baseParams)

    expect(first.status).toBe('sent')
    expect(second).toEqual({ status: 'skipped_duplicate' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('protects against two concurrent delivery attempts for the same notification row racing each other', async () => {
    const { store } = createFakeEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const deps: SendExtensionNotificationDeps = { emailLog: store, resendConfig, sendEmail }

    const [a, b] = await Promise.all([
      sendExtensionNotificationEmailIdempotently(deps, baseParams),
      sendExtensionNotificationEmailIdempotently(deps, baseParams),
    ])

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual(['sent', 'skipped_duplicate'])
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('records a send failure and does not throw', async () => {
    const { store, failedIds } = createFakeEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: false, errorMessage: 'Resend API error 500' }))
    const deps: SendExtensionNotificationDeps = { emailLog: store, resendConfig, sendEmail }

    const outcome = await sendExtensionNotificationEmailIdempotently(deps, baseParams)

    expect(outcome).toEqual({ status: 'send_failed', emailLogId: 'log-1', errorMessage: 'Resend API error 500' })
    expect(failedIds).toEqual([{ id: 'log-1', reason: 'Resend API error 500' }])
  })

  it('renders Arabic/RTL HTML when language is ar', async () => {
    const { store } = createFakeEmailLogStore()
    let capturedHtml = ''
    const sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })
    const deps: SendExtensionNotificationDeps = { emailLog: store, resendConfig, sendEmail }

    await sendExtensionNotificationEmailIdempotently(deps, { ...baseParams, language: 'ar' })

    expect(capturedHtml).toContain('dir="rtl"')
    expect(capturedHtml).toContain('تم تأكيد التمديد')
  })

  it('HTML-escapes a hostile rejection reason for extension_rejected', async () => {
    const { store } = createFakeEmailLogStore()
    let capturedHtml = ''
    const sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })
    const deps: SendExtensionNotificationDeps = { emailLog: store, resendConfig, sendEmail }

    await sendExtensionNotificationEmailIdempotently(deps, {
      ...baseParams,
      notificationType: 'extension_rejected',
      payload: { reason: '<img src=x onerror=alert(1)>' },
    })

    expect(capturedHtml).not.toContain('<img')
  })

  it('HTML-escapes hostile plate numbers for vehicle_reassigned', async () => {
    const { store } = createFakeEmailLogStore()
    let capturedHtml = ''
    const sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })
    const deps: SendExtensionNotificationDeps = { emailLog: store, resendConfig, sendEmail }

    await sendExtensionNotificationEmailIdempotently(deps, {
      ...baseParams,
      notificationType: 'vehicle_reassigned',
      payload: { original_vehicle_plate: '<script>alert(1)</script>', new_vehicle_plate: 'XYZ-999' },
    })

    expect(capturedHtml).not.toContain('<script>')
  })

  it('sends to the resolved recipient address only', async () => {
    const { store } = createFakeEmailLogStore()
    let capturedTo = ''
    const sendEmail = vi.fn(async (_config, params: { to: string }) => {
      capturedTo = params.to
      return { ok: true, providerMessageId: 'msg-1' }
    })
    const deps: SendExtensionNotificationDeps = { emailLog: store, resendConfig, sendEmail }

    await sendExtensionNotificationEmailIdempotently(deps, {
      ...baseParams,
      recipient: { name: 'Someone Else', email: 'resolved-from-db@example.com' },
    })

    expect(capturedTo).toBe('resolved-from-db@example.com')
  })

  it('includes the pre-filled ?ref= Manage Booking link in the rendered email', async () => {
    const { store } = createFakeEmailLogStore()
    let capturedHtml = ''
    const sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })
    const deps: SendExtensionNotificationDeps = { emailLog: store, resendConfig, sendEmail }

    await sendExtensionNotificationEmailIdempotently(deps, baseParams)

    expect(capturedHtml).toContain('https://bliss.rent/manage-booking?ref=BLS-D300AC89')
  })
})
