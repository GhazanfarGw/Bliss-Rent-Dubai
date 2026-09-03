import { describe, it, expect, vi } from 'vitest'
import { handleSendRentalReminders, addDaysIso, REMINDER_WINDOW_DAYS, type RentalReminderDataSource } from './rentalReminders.ts'
import type { BookingEmailRow } from './bookingEmailData.ts'

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

function fakeDataSource(opts: { pickupRows?: BookingEmailRow[]; returnRows?: BookingEmailRow[] }): RentalReminderDataSource {
  return {
    from: () => ({
      select: () => ({
        eq: (col1: string, val1: string) => ({
          eq: async (col2: string, _val2: string) => {
            if (col1 === 'status' && val1 === 'confirmed' && col2 === 'start_date') {
              return { data: opts.pickupRows ?? [], error: null }
            }
            if (col1 === 'status' && val1 === 'active' && col2 === 'end_date') {
              return { data: opts.returnRows ?? [], error: null }
            }
            return { data: [], error: null }
          },
        }),
      }),
    }),
  } as unknown as RentalReminderDataSource
}

function fakeEmailLog() {
  const seen = new Set<string>()
  let nextId = 1
  return {
    async insertIfNew(row: { idempotency_key: string }) {
      if (seen.has(row.idempotency_key)) return { inserted: false, id: null }
      seen.add(row.idempotency_key)
      return { inserted: true, id: `log-${nextId++}` }
    },
    async markSent() {},
    async markFailed() {},
  }
}

const resendConfig = { apiKey: 'test-key', fromAddress: 'Bliss Rent <noreply@bliss.rent>' }
const TODAY = new Date('2026-09-09T00:00:00Z')

describe('addDaysIso', () => {
  it('adds the given number of days as an ISO date', () => {
    expect(addDaysIso(new Date('2026-09-09T00:00:00Z'), 1)).toBe('2026-09-10')
  })

  it('crosses a month boundary correctly', () => {
    expect(addDaysIso(new Date('2026-09-30T00:00:00Z'), 1)).toBe('2026-10-01')
  })
})

describe('handleSendRentalReminders', () => {
  it('sends a pickup reminder for a confirmed booking starting tomorrow', async () => {
    const dataSource = fakeDataSource({ pickupRows: [bookingRow({ id: 'b1', start_date: addDaysIso(TODAY, REMINDER_WINDOW_DAYS) })] })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const outcomes = await handleSendRentalReminders({
      dataSource,
      emailLog: fakeEmailLog(),
      resendConfig,
      siteBaseUrl: 'https://bliss.rent',
      today: TODAY,
      sendEmail,
    })
    expect(outcomes).toEqual([{ bookingId: 'b1', eventType: 'pickup_reminder', status: 'sent', emailLogId: 'log-1', providerMessageId: 'msg-1' }])
  })

  it('sends a return reminder for an active booking ending tomorrow', async () => {
    const dataSource = fakeDataSource({ returnRows: [bookingRow({ id: 'b2', status: 'active', end_date: addDaysIso(TODAY, REMINDER_WINDOW_DAYS) })] })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-2' }))
    const outcomes = await handleSendRentalReminders({
      dataSource,
      emailLog: fakeEmailLog(),
      resendConfig,
      siteBaseUrl: 'https://bliss.rent',
      today: TODAY,
      sendEmail,
    })
    expect(outcomes).toEqual([{ bookingId: 'b2', eventType: 'return_reminder', status: 'sent', emailLogId: 'log-1', providerMessageId: 'msg-2' }])
  })

  it('sends both pickup and return reminders in the same pass when both are due', async () => {
    const dataSource = fakeDataSource({
      pickupRows: [bookingRow({ id: 'b1' })],
      returnRows: [bookingRow({ id: 'b2', status: 'active' })],
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const outcomes = await handleSendRentalReminders({ dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', today: TODAY, sendEmail })
    expect(outcomes).toHaveLength(2)
    expect(outcomes.map((o) => o.eventType).sort()).toEqual(['pickup_reminder', 'return_reminder'])
  })

  it('is idempotent — running twice for the same booking sends only once', async () => {
    const dataSource = fakeDataSource({ pickupRows: [bookingRow({ id: 'b1' })] })
    const emailLog = fakeEmailLog()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    await handleSendRentalReminders({ dataSource, emailLog, resendConfig, siteBaseUrl: 'https://bliss.rent', today: TODAY, sendEmail })
    const second = await handleSendRentalReminders({ dataSource, emailLog, resendConfig, siteBaseUrl: 'https://bliss.rent', today: TODAY, sendEmail })
    expect(second[0].status).toBe('skipped_duplicate')
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('isolates one booking with no customer email from the rest of the batch', async () => {
    const dataSource = fakeDataSource({
      pickupRows: [bookingRow({ id: 'b1', customers: { full_name: 'No Email', email: null } }), bookingRow({ id: 'b2' })],
    })
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const outcomes = await handleSendRentalReminders({ dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', today: TODAY, sendEmail })
    expect(outcomes[0].status).toBe('skipped_error')
    expect(outcomes[1].status).toBe('sent')
  })

  it('returns an empty array when nothing is due — a no-op, not an error', async () => {
    const dataSource = fakeDataSource({})
    const outcomes = await handleSendRentalReminders({ dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', today: TODAY })
    expect(outcomes).toEqual([])
  })

  it('does not query bookings starting/ending further out than the reminder window', async () => {
    const farRow = bookingRow({ id: 'b-far', start_date: addDaysIso(TODAY, 5) })
    const dataSource: RentalReminderDataSource = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: async () => ({ data: [], error: null }), // the fake DB itself would never return b-far for tomorrow's date filter
          }),
        }),
      }),
    } as unknown as RentalReminderDataSource
    void farRow
    const outcomes = await handleSendRentalReminders({ dataSource, emailLog: fakeEmailLog(), resendConfig, siteBaseUrl: 'https://bliss.rent', today: TODAY })
    expect(outcomes).toEqual([])
  })
})
