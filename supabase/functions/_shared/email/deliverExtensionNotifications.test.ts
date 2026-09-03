import { describe, it, expect, vi } from 'vitest'
import { deliverExtensionNotificationEmails, type DeliverExtensionNotificationsDataSource } from './deliverExtensionNotifications.ts'
import type { BookingEmailRow } from './bookingEmailData.ts'
import type { BookingNotificationRow } from './extensionNotificationData.ts'

function bookingRow(overrides: Partial<BookingEmailRow> = {}): BookingEmailRow {
  return {
    id: 'b1',
    status: 'confirmed',
    start_date: '2026-09-10',
    end_date: '2026-09-20',
    total_price: 1000,
    currency: 'AED',
    customers: { full_name: 'Jane Renter', email: 'jane@example.com' },
    vehicles: { make: 'Toyota', model: 'Camry' },
    pickup_location: { name: 'DXB Terminal 3' },
    dropoff_location: { name: 'DXB Terminal 3' },
    ...overrides,
  }
}

function fakeDataSource(opts: {
  extension: { id: string; booking_id: string; conflict_booking_id: string | null }
  notifications: BookingNotificationRow[]
  bookingRows: Record<string, BookingEmailRow | null>
}): DeliverExtensionNotificationsDataSource {
  return {
    from: (table: string) => {
      if (table === 'booking_extensions') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: opts.extension, error: null }),
            }),
          }),
        }
      }
      if (table === 'booking_notifications') {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                limit: async () => ({ data: opts.notifications, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'bookings') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: opts.bookingRows[id] ?? null, error: null }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table in test fake: ${table}`)
    },
  } as unknown as DeliverExtensionNotificationsDataSource
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

describe('deliverExtensionNotificationEmails', () => {
  it('delivers a single extension_approved notification for the extension\'s own booking when there is no reassignment', async () => {
    const dataSource = fakeDataSource({
      extension: { id: 'ext-1', booking_id: 'b1', conflict_booking_id: null },
      notifications: [
        { id: 'n1', booking_id: 'b1', notification_type: 'extension_approved', payload: { extension_days: 2, amount: 200, currency: 'AED' }, created_at: '2026-09-01T00:00:00Z' },
      ],
      bookingRows: { b1: bookingRow() },
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverExtensionNotificationEmails(
      { dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      'ext-1',
      'en',
    )

    expect(outcomes).toEqual([
      { notificationId: 'n1', bookingId: 'b1', notificationType: 'extension_approved', status: 'sent', emailLogId: 'log-1', providerMessageId: 'msg-1' },
    ])
  })

  it('delivers BOTH the extension_approved notification (own booking) and the vehicle_reassigned notification (conflict booking) when a reassignment happened', async () => {
    const dataSource = fakeDataSource({
      extension: { id: 'ext-1', booking_id: 'b1', conflict_booking_id: 'b2' },
      notifications: [
        { id: 'n1', booking_id: 'b1', notification_type: 'extension_approved', payload: { extension_days: 2, amount: 200, currency: 'AED' }, created_at: '2026-09-01T00:01:00Z' },
        { id: 'n2', booking_id: 'b2', notification_type: 'vehicle_reassigned', payload: { original_vehicle_plate: 'ABC-123', new_vehicle_plate: 'XYZ-999' }, created_at: '2026-09-01T00:00:00Z' },
      ],
      bookingRows: {
        b1: bookingRow({ id: 'b1' }),
        b2: bookingRow({ id: 'b2', customers: { full_name: 'Other Renter', email: 'other@example.com' } }),
      },
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverExtensionNotificationEmails(
      { dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      'ext-1',
      'en',
    )

    expect(outcomes).toHaveLength(2)
    expect(outcomes.map((o) => o.notificationType).sort()).toEqual(['extension_approved', 'vehicle_reassigned'])
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })

  it('isolates a missing-recipient failure on one row from delivering the other row in the same batch', async () => {
    const dataSource = fakeDataSource({
      extension: { id: 'ext-1', booking_id: 'b1', conflict_booking_id: 'b2' },
      notifications: [
        { id: 'n1', booking_id: 'b1', notification_type: 'extension_approved', payload: {}, created_at: '2026-09-01T00:01:00Z' },
        { id: 'n2', booking_id: 'b2', notification_type: 'vehicle_reassigned', payload: {}, created_at: '2026-09-01T00:00:00Z' },
      ],
      bookingRows: {
        b1: bookingRow({ id: 'b1' }),
        b2: bookingRow({ id: 'b2', customers: { full_name: 'Other Renter', email: null } }), // no email on file
      },
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverExtensionNotificationEmails(
      { dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      'ext-1',
      'en',
    )

    const b1Outcome = outcomes.find((o) => o.bookingId === 'b1')
    const b2Outcome = outcomes.find((o) => o.bookingId === 'b2')
    expect(b1Outcome?.status).toBe('sent')
    expect(b2Outcome?.status).toBe('skipped_no_recipient')
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('isolates a booking-not-found failure on one row from delivering the other row', async () => {
    const dataSource = fakeDataSource({
      extension: { id: 'ext-1', booking_id: 'b1', conflict_booking_id: 'b2' },
      notifications: [
        { id: 'n1', booking_id: 'b1', notification_type: 'extension_approved', payload: {}, created_at: '2026-09-01T00:01:00Z' },
        { id: 'n2', booking_id: 'b2', notification_type: 'vehicle_reassigned', payload: {}, created_at: '2026-09-01T00:00:00Z' },
      ],
      bookingRows: { b1: bookingRow({ id: 'b1' }), b2: null }, // b2 vanished / not found
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverExtensionNotificationEmails(
      { dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      'ext-1',
      'en',
    )

    expect(outcomes.find((o) => o.bookingId === 'b1')?.status).toBe('sent')
    expect(outcomes.find((o) => o.bookingId === 'b2')?.status).toBe('skipped_no_recipient')
  })

  it('is a no-op returning an empty array when there are no booking_notifications rows to deliver', async () => {
    const dataSource = fakeDataSource({
      extension: { id: 'ext-1', booking_id: 'b1', conflict_booking_id: null },
      notifications: [],
      bookingRows: { b1: bookingRow() },
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverExtensionNotificationEmails(
      { dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      'ext-1',
      'en',
    )

    expect(outcomes).toEqual([])
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('skips a future/unknown notification_type rather than guessing at its content', async () => {
    const dataSource = fakeDataSource({
      extension: { id: 'ext-1', booking_id: 'b1', conflict_booking_id: null },
      notifications: [
        { id: 'n1', booking_id: 'b1', notification_type: 'some_future_type', payload: {}, created_at: '2026-09-01T00:00:00Z' },
      ],
      bookingRows: { b1: bookingRow() },
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverExtensionNotificationEmails(
      { dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      'ext-1',
      'en',
    )

    expect(outcomes).toEqual([])
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('is idempotent across two separate delivery calls for the same extension (e.g. the admin action retried)', async () => {
    const dataSource = fakeDataSource({
      extension: { id: 'ext-1', booking_id: 'b1', conflict_booking_id: null },
      notifications: [
        { id: 'n1', booking_id: 'b1', notification_type: 'extension_approved', payload: {}, created_at: '2026-09-01T00:00:00Z' },
      ],
      bookingRows: { b1: bookingRow() },
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const emailLog = fakeEmailLog()

    await deliverExtensionNotificationEmails({ dataSource, emailLog, resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail }, 'ext-1', 'en')
    const second = await deliverExtensionNotificationEmails({ dataSource, emailLog, resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail }, 'ext-1', 'en')

    expect(second[0].status).toBe('skipped_duplicate')
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })
})
