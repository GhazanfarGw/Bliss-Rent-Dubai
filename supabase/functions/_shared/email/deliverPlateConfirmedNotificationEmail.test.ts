import { describe, it, expect, vi } from 'vitest'
import { deliverPlateConfirmedNotificationEmail, type DeliverPlateConfirmedNotificationDataSource } from './deliverPlateConfirmedNotificationEmail.ts'
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
    vehicles: { make: 'Nissan', model: 'Sentra' },
    pickup_location: { name: 'DXB Terminal 3' },
    dropoff_location: { name: 'DXB Terminal 3' },
    ...overrides,
  }
}

function fakeDataSource(opts: {
  notifications: BookingNotificationRow[]
  bookingRows: Record<string, BookingEmailRow | null>
}): DeliverPlateConfirmedNotificationDataSource {
  return {
    from: (table: string) => {
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
  } as unknown as DeliverPlateConfirmedNotificationDataSource
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

const resendConfig = { apiKey: 'test-key', fromAddress: 'Bliss Rent <booking@bliss.rent>' }

describe('deliverPlateConfirmedNotificationEmail', () => {
  it('delivers the plate_confirmed notification for the given booking', async () => {
    const dataSource = fakeDataSource({
      notifications: [
        {
          id: 'n1',
          booking_id: 'b1',
          notification_type: 'plate_confirmed',
          payload: { booking_reference: 'BLS-D300AC89', plate_number: 'DXB-A-12345', make: 'Nissan', model: 'Sentra' },
          created_at: '2026-09-07T00:00:00Z',
        },
      ],
      bookingRows: { b1: bookingRow() },
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverPlateConfirmedNotificationEmail(
      { dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      'b1',
      'en',
    )

    expect(outcomes).toEqual([{ notificationId: 'n1', bookingId: 'b1', status: 'sent', emailLogId: 'log-1', providerMessageId: 'msg-1' }])
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('is a no-op returning an empty array when the booking has no plate_confirmed notification', async () => {
    const dataSource = fakeDataSource({ notifications: [], bookingRows: { b1: bookingRow() } })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverPlateConfirmedNotificationEmail(
      { dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      'b1',
      'en',
    )

    expect(outcomes).toEqual([])
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('ignores notification rows of a different type for the same booking (e.g. an older vehicle_reassigned row)', async () => {
    const dataSource = fakeDataSource({
      notifications: [
        { id: 'n0', booking_id: 'b1', notification_type: 'vehicle_reassigned', payload: {}, created_at: '2026-09-01T00:00:00Z' },
      ],
      bookingRows: { b1: bookingRow() },
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverPlateConfirmedNotificationEmail(
      { dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      'b1',
      'en',
    )

    expect(outcomes).toEqual([])
  })

  it('delivers only the MOST RECENT plate_confirmed row when a booking has more than one (a since-superseded confirmation)', async () => {
    const dataSource = fakeDataSource({
      notifications: [
        // fetchBookingNotifications orders newest-first — this fake returns
        // them pre-sorted the same way the real ordered query would.
        { id: 'n2', booking_id: 'b1', notification_type: 'plate_confirmed', payload: { plate_number: 'DXB-A-99999' }, created_at: '2026-09-07T01:00:00Z' },
        { id: 'n1', booking_id: 'b1', notification_type: 'plate_confirmed', payload: { plate_number: 'DXB-A-12345' }, created_at: '2026-09-07T00:00:00Z' },
      ],
      bookingRows: { b1: bookingRow() },
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverPlateConfirmedNotificationEmail(
      { dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      'b1',
      'en',
    )

    expect(outcomes).toHaveLength(1)
    expect(outcomes[0].notificationId).toBe('n2')
  })

  it('isolates a missing-recipient failure into a skipped_no_recipient outcome rather than throwing', async () => {
    const dataSource = fakeDataSource({
      notifications: [
        { id: 'n1', booking_id: 'b1', notification_type: 'plate_confirmed', payload: { plate_number: 'DXB-A-1' }, created_at: '2026-09-07T00:00:00Z' },
      ],
      bookingRows: { b1: bookingRow({ customers: { full_name: 'Jane Renter', email: null } }) },
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverPlateConfirmedNotificationEmail(
      { dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      'b1',
      'en',
    )

    expect(outcomes[0].status).toBe('skipped_no_recipient')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('isolates a booking-not-found failure into a skipped_no_recipient outcome rather than throwing', async () => {
    const dataSource = fakeDataSource({
      notifications: [
        { id: 'n1', booking_id: 'b1', notification_type: 'plate_confirmed', payload: { plate_number: 'DXB-A-1' }, created_at: '2026-09-07T00:00:00Z' },
      ],
      bookingRows: { b1: null },
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcomes = await deliverPlateConfirmedNotificationEmail(
      { dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail },
      'b1',
      'en',
    )

    expect(outcomes[0].status).toBe('skipped_no_recipient')
  })

  it('is idempotent across two separate delivery calls for the same booking (e.g. the admin best-effort trigger retried)', async () => {
    const dataSource = fakeDataSource({
      notifications: [
        { id: 'n1', booking_id: 'b1', notification_type: 'plate_confirmed', payload: { plate_number: 'DXB-A-1' }, created_at: '2026-09-07T00:00:00Z' },
      ],
      bookingRows: { b1: bookingRow() },
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const emailLog = fakeEmailLog()

    await deliverPlateConfirmedNotificationEmail({ dataSource, emailLog, resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail }, 'b1', 'en')
    const second = await deliverPlateConfirmedNotificationEmail({ dataSource, emailLog, resendConfig, siteBaseUrl: 'https://bliss.rent', sendEmail }, 'b1', 'en')

    expect(second[0].status).toBe('skipped_duplicate')
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })
})
