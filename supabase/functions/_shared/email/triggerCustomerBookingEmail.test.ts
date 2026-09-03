import { describe, it, expect, vi } from 'vitest'
import { triggerCustomerBookingEmail } from './triggerCustomerBookingEmail.ts'
import type { BookingEmailRow } from './bookingEmailData.ts'

const bookingRow: BookingEmailRow = {
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
}

function fakeDataSource(row: BookingEmailRow | null = bookingRow) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    }),
  }
}

function baseParams(overrides: Partial<Parameters<typeof triggerCustomerBookingEmail>[0]> = {}) {
  return {
    dataSource: fakeDataSource(),
    emailLog: {
      insertIfNew: vi.fn(async () => ({ inserted: true, id: 'log-1' })),
      markSent: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    },
    resendConfig: { apiKey: 'test-key', fromAddress: 'Bliss Rent <noreply@bliss.rent>' },
    siteBaseUrl: 'https://bliss.rent',
    bookingId: 'b1',
    eventType: 'booking_received' as const,
    language: 'en' as const,
    sendEmail: vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' })),
    ...overrides,
  }
}

describe('triggerCustomerBookingEmail', () => {
  it('never throws when the booking row cannot be found', async () => {
    const params = baseParams({ dataSource: fakeDataSource(null) })
    await expect(triggerCustomerBookingEmail(params)).resolves.toBeUndefined()
    expect(params.emailLog.insertIfNew).not.toHaveBeenCalled()
  })

  it('never throws when the customer has no email on file', async () => {
    const params = baseParams({
      dataSource: fakeDataSource({ ...bookingRow, customers: { full_name: 'Jane', email: null } }),
    })
    await expect(triggerCustomerBookingEmail(params)).resolves.toBeUndefined()
    expect(params.emailLog.insertIfNew).not.toHaveBeenCalled()
  })

  it('never throws when the email_log store itself errors', async () => {
    const params = baseParams({
      emailLog: {
        insertIfNew: vi.fn(async () => {
          throw new Error('connection reset')
        }),
        markSent: vi.fn(async () => undefined),
        markFailed: vi.fn(async () => undefined),
      },
    })
    await expect(triggerCustomerBookingEmail(params)).resolves.toBeUndefined()
  })

  it('records the email_log row and sends for a successful lookup', async () => {
    const params = baseParams()
    await triggerCustomerBookingEmail(params)
    expect(params.emailLog.insertIfNew).toHaveBeenCalledTimes(1)
    expect(params.emailLog.insertIfNew).toHaveBeenCalledWith(
      expect.objectContaining({ booking_id: 'b1', event_type: 'booking_received', recipient_email: 'jane@example.com' }),
    )
    expect(params.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('never throws when the send itself fails — the failure is recorded, not propagated', async () => {
    const params = baseParams({ sendEmail: vi.fn(async () => ({ ok: false, errorMessage: 'Resend API error 500' })) })
    await expect(triggerCustomerBookingEmail(params)).resolves.toBeUndefined()
    expect(params.emailLog.markFailed).toHaveBeenCalledWith('log-1', 'Resend API error 500')
  })
})
