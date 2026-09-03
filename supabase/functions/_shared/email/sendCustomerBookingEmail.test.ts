import { describe, it, expect, vi } from 'vitest'
import { sendCustomerBookingEmailIdempotently, type EmailLogStore, type EmailLogInsertRow } from './sendCustomerBookingEmail.ts'
import type { BookingSummary } from './types.ts'

const summary: BookingSummary = {
  reference: 'BLS-D300AC89',
  vehicleName: 'Toyota Camry',
  rentalDatesLabel: '2026-09-10 → 2026-09-15',
  pickupLabel: 'DXB Terminal 3',
  dropoffLabel: 'DXB Terminal 3',
  amountLabel: 'AED 750',
}

const baseParams = {
  eventType: 'booking_confirmed' as const,
  bookingId: 'd300ac89-03b4-4f51-93b9-49b7c3f235d7',
  bookingReference: 'BLS-D300AC89',
  recipient: { name: 'Jane Renter', email: 'jane@example.com' },
  summary,
  language: 'en' as const,
  siteBaseUrl: 'https://bliss.rent',
}

const resendConfig = { apiKey: 'test-key', fromAddress: 'Bliss Rent <noreply@bliss.rent>' }

/**
 * An in-memory store that models the REAL unique-index behavior: a
 * `Set` keyed on idempotency_key stands in for the database's unique
 * index, and `insertIfNew` is the single atomic operation the real
 * `.upsert(..., { ignoreDuplicates: true })` call is contracted to be —
 * exactly one caller ever gets `inserted: true` for a given key, even
 * when both "requests" are in flight at the same time (see the
 * concurrent test below, which calls this without ever awaiting between
 * the two insertIfNew calls).
 */
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

describe('sendCustomerBookingEmailIdempotently', () => {
  it('sends once and records the email_log row on success', async () => {
    const { store, sentIds, rows } = createFakeEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcome = await sendCustomerBookingEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)

    expect(outcome).toEqual({ status: 'sent', emailLogId: 'log-1', providerMessageId: 'msg-1' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sentIds).toEqual(['log-1'])
    expect(rows[0].recipient_email).toBe('jane@example.com')
    expect(rows[0].idempotency_key).toBe('booking:d300ac89-03b4-4f51-93b9-49b7c3f235d7:booking_confirmed')
  })

  it('records a send failure and does not throw', async () => {
    const { store, failedIds } = createFakeEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: false, errorMessage: 'Resend API error 500' }))

    const outcome = await sendCustomerBookingEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)

    expect(outcome).toEqual({ status: 'send_failed', emailLogId: 'log-1', errorMessage: 'Resend API error 500' })
    expect(failedIds).toEqual([{ id: 'log-1', reason: 'Resend API error 500' }])
  })

  it('is a no-op on a second call for the exact same event (duplicate trigger fire)', async () => {
    const { store } = createFakeEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const deps = { emailLog: store, resendConfig, sendEmail }

    const first = await sendCustomerBookingEmailIdempotently(deps, baseParams)
    const second = await sendCustomerBookingEmailIdempotently(deps, baseParams)

    expect(first.status).toBe('sent')
    expect(second).toEqual({ status: 'skipped_duplicate' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('protects against two concurrent calls for the same event racing each other (no select-then-insert gap)', async () => {
    const { store } = createFakeEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const deps = { emailLog: store, resendConfig, sendEmail }

    // Fire both "requests" without awaiting either first — this is what
    // a race actually looks like, not two sequential calls.
    const [a, b] = await Promise.all([
      sendCustomerBookingEmailIdempotently(deps, baseParams),
      sendCustomerBookingEmailIdempotently(deps, baseParams),
    ])

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual(['sent', 'skipped_duplicate'])
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('sends separate emails for different bookings (different idempotency keys)', async () => {
    const { store } = createFakeEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const deps = { emailLog: store, resendConfig, sendEmail }

    const first = await sendCustomerBookingEmailIdempotently(deps, baseParams)
    const second = await sendCustomerBookingEmailIdempotently(deps, { ...baseParams, bookingId: 'other-booking-id' })

    expect(first.status).toBe('sent')
    expect(second.status).toBe('sent')
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })

  it('renders Arabic/RTL HTML when language is ar', async () => {
    const { store } = createFakeEmailLogStore()
    let capturedHtml = ''
    const sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })

    await sendCustomerBookingEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, { ...baseParams, language: 'ar' })

    expect(capturedHtml).toContain('dir="rtl"')
    expect(capturedHtml).toContain('تم تأكيد الحجز')
  })

  it('HTML-escapes a hostile vehicle name from the booking summary', async () => {
    const { store } = createFakeEmailLogStore()
    let capturedHtml = ''
    const sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })

    await sendCustomerBookingEmailIdempotently(
      { emailLog: store, resendConfig, sendEmail },
      { ...baseParams, summary: { ...summary, vehicleName: '<img src=x onerror=alert(1)>' } },
    )

    expect(capturedHtml).not.toContain('<img')
  })

  it('sends to the resolved recipient address, never a value baseParams does not itself control', async () => {
    const { store } = createFakeEmailLogStore()
    let capturedTo = ''
    const sendEmail = vi.fn(async (_config, params: { to: string }) => {
      capturedTo = params.to
      return { ok: true, providerMessageId: 'msg-1' }
    })

    await sendCustomerBookingEmailIdempotently(
      { emailLog: store, resendConfig, sendEmail },
      { ...baseParams, recipient: { name: 'Jane Renter', email: 'resolved-from-db@example.com' } },
    )

    expect(capturedTo).toBe('resolved-from-db@example.com')
  })

  it('includes the pre-filled ?ref= Manage Booking link in the rendered email', async () => {
    const { store } = createFakeEmailLogStore()
    let capturedHtml = ''
    const sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })

    await sendCustomerBookingEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)

    expect(capturedHtml).toContain('https://bliss.rent/manage-booking?ref=BLS-D300AC89')
  })
})
