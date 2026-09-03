import { describe, it, expect, vi } from 'vitest'
import { deliverAdminOperationalEmails, type DeliverAdminOperationalEmailsDataSource } from './deliverAdminOperationalEmails.ts'
import type { BookingEmailRow } from './bookingEmailData.ts'
import type { ActiveAdminRow } from './adminRecipients.ts'

function bookingRow(overrides: Partial<BookingEmailRow> = {}): BookingEmailRow {
  return {
    id: 'b1',
    status: 'confirmed',
    start_date: '2026-09-10',
    end_date: '2026-09-15',
    total_price: 750,
    currency: 'AED',
    customers: { full_name: 'Jane Renter', email: 'jane@example.com' },
    vehicles: { make: 'Toyota', model: 'Camry' },
    pickup_location: { name: 'DXB Terminal 3' },
    dropoff_location: { name: 'DXB Terminal 3' },
    ...overrides,
  }
}

function fakeDataSource(opts: {
  booking: BookingEmailRow | null
  admins: ActiveAdminRow[]
}): DeliverAdminOperationalEmailsDataSource {
  return {
    from: (table: string) => {
      if (table === 'bookings') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.booking, error: null }) }) }) }
      }
      if (table === 'admin_profiles') {
        return { select: () => ({ eq: async () => ({ data: opts.admins, error: null }) }) }
      }
      throw new Error(`unexpected table in test fake: ${table}`)
    },
  } as unknown as DeliverAdminOperationalEmailsDataSource
}

function fakeEmailLog() {
  const seen = new Map<string, string>()
  let nextId = 1
  return {
    async insertIfNew(row: { idempotency_key: string }) {
      if (seen.has(row.idempotency_key)) return { inserted: false, id: null }
      const id = `log-${nextId++}`
      seen.set(row.idempotency_key, id)
      return { inserted: true, id }
    },
    async markSent() {},
    async markFailed() {},
  }
}

const resendConfig = { apiKey: 'test-key', fromAddress: 'Bliss Rent <noreply@bliss.rent>' }

const baseParams = {
  bookingId: 'b1',
  eventType: 'admin_booking_confirmed' as const,
  language: 'en' as const,
  dashboardPath: '/admin/bookings/b1',
}

describe('deliverAdminOperationalEmails', () => {
  it('delivers to every active admin, resolved via the injected getAdminEmail', async () => {
    const dataSource = fakeDataSource({
      booking: bookingRow(),
      admins: [
        { id: 'admin-1', full_name: 'Aisha Owner' },
        { id: 'admin-2', full_name: 'Karim Staff' },
      ],
    })
    const getAdminEmail = vi.fn(async (id: string) => (id === 'admin-1' ? 'owner@example.com' : 'staff@example.com'))
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverAdminOperationalEmails(
      { dataSource, getAdminEmail, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      baseParams,
    )

    expect(outcomes).toEqual([
      { recipientEmail: 'owner@example.com', status: 'sent', emailLogId: 'log-1', providerMessageId: 'msg-1' },
      { recipientEmail: 'staff@example.com', status: 'sent', emailLogId: 'log-2', providerMessageId: 'msg-1' },
    ])
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })

  it('isolates one admin recipient\'s send failure from delivering to the other active admin', async () => {
    const dataSource = fakeDataSource({
      booking: bookingRow(),
      admins: [
        { id: 'admin-1', full_name: 'Aisha Owner' },
        { id: 'admin-2', full_name: 'Karim Staff' },
      ],
    })
    const getAdminEmail = vi.fn(async (id: string) => (id === 'admin-1' ? 'owner@example.com' : 'staff@example.com'))
    const sendEmail = vi.fn(async (_config, params: { to: string }) => {
      if (params.to === 'staff@example.com') return { ok: false, errorMessage: 'Resend API error 500' }
      return { ok: true, providerMessageId: 'msg-1' }
    })

    const outcomes = await deliverAdminOperationalEmails(
      { dataSource, getAdminEmail, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      baseParams,
    )

    const ownerOutcome = outcomes.find((o) => o.recipientEmail === 'owner@example.com')
    const staffOutcome = outcomes.find((o) => o.recipientEmail === 'staff@example.com')
    expect(ownerOutcome?.status).toBe('sent')
    expect(staffOutcome?.status).toBe('send_failed')
  })

  it('isolates an unexpected per-recipient error (e.g. the email_log insert throwing) from the other admin', async () => {
    const dataSource = fakeDataSource({
      booking: bookingRow(),
      admins: [
        { id: 'admin-1', full_name: 'Aisha Owner' },
        { id: 'admin-2', full_name: 'Karim Staff' },
      ],
    })
    const getAdminEmail = vi.fn(async (id: string) => (id === 'admin-1' ? 'owner@example.com' : 'staff@example.com'))
    const emailLog = {
      async insertIfNew(row: { idempotency_key: string; recipient_email: string }) {
        if (row.recipient_email === 'staff@example.com') throw new Error('email_log unreachable')
        return { inserted: true, id: 'log-1' }
      },
      async markSent() {},
      async markFailed() {},
    }
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverAdminOperationalEmails(
      { dataSource, getAdminEmail, emailLog, resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      baseParams,
    )

    const ownerOutcome = outcomes.find((o) => o.recipientEmail === 'owner@example.com')
    const staffOutcome = outcomes.find((o) => o.recipientEmail === 'staff@example.com')
    expect(ownerOutcome?.status).toBe('sent')
    expect(staffOutcome).toEqual({ recipientEmail: 'staff@example.com', status: 'skipped_error', errorMessage: 'email_log unreachable' })
  })

  it('returns an empty array (no error) when there are no active admins to notify', async () => {
    const dataSource = fakeDataSource({ booking: bookingRow(), admins: [] })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverAdminOperationalEmails(
      { dataSource, getAdminEmail: vi.fn(), emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      baseParams,
    )

    expect(outcomes).toEqual([])
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('propagates a not-found booking as a real error, rather than silently sending nothing', async () => {
    const dataSource = fakeDataSource({ booking: null, admins: [{ id: 'admin-1', full_name: 'Aisha Owner' }] })
    await expect(
      deliverAdminOperationalEmails(
        { dataSource, getAdminEmail: vi.fn(async () => 'owner@example.com'), emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent' },
        baseParams,
      ),
    ).rejects.toThrow()
  })

  it('is idempotent across two separate delivery calls for the same booking/event (e.g. a retried Edge Function invocation)', async () => {
    const dataSource = fakeDataSource({ booking: bookingRow(), admins: [{ id: 'admin-1', full_name: 'Aisha Owner' }] })
    const getAdminEmail = vi.fn(async () => 'owner@example.com')
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const emailLog = fakeEmailLog()
    const deps = { dataSource, getAdminEmail, emailLog, resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail }

    await deliverAdminOperationalEmails(deps, baseParams)
    const second = await deliverAdminOperationalEmails(deps, baseParams)

    expect(second[0].status).toBe('skipped_duplicate')
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('passes triggeringRowId through so a repeatable event (admin_extension_requested) keys correctly per occurrence', async () => {
    const dataSource = fakeDataSource({ booking: bookingRow(), admins: [{ id: 'admin-1', full_name: 'Aisha Owner' }] })
    const getAdminEmail = vi.fn(async () => 'owner@example.com')
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const emailLog = fakeEmailLog()
    const deps = { dataSource, getAdminEmail, emailLog, resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail }
    const params = { bookingId: 'b1', eventType: 'admin_extension_requested' as const, language: 'en' as const, dashboardPath: '/admin/extensions' }

    const first = await deliverAdminOperationalEmails(deps, { ...params, triggeringRowId: 'ext-1' })
    const second = await deliverAdminOperationalEmails(deps, { ...params, triggeringRowId: 'ext-2' })

    expect(first[0].status).toBe('sent')
    expect(second[0].status).toBe('sent')
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })
})
