import { describe, it, expect, vi } from 'vitest'
import { triggerAdminOperationalEmail } from './triggerAdminOperationalEmail.ts'
import type { BookingEmailRow } from './bookingEmailData.ts'
import type { ActiveAdminRow } from './adminRecipients.ts'

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

function fakeDataSource(row: BookingEmailRow | null = bookingRow, admins: ActiveAdminRow[] = [{ id: 'admin-1', full_name: 'Aisha Owner' }]) {
  return {
    from: (table: string) => {
      if (table === 'bookings') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }
      }
      if (table === 'admin_profiles') {
        return { select: () => ({ eq: async () => ({ data: admins, error: null }) }) }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }
}

function baseParams(overrides: Partial<Parameters<typeof triggerAdminOperationalEmail>[0]> = {}) {
  return {
    dataSource: fakeDataSource() as never,
    getAdminEmail: vi.fn(async () => 'owner@example.com'),
    emailLog: {
      insertIfNew: vi.fn(async () => ({ inserted: true, id: 'log-1' })),
      markSent: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    },
    resendConfig: { apiKey: 'test-key', fromAddress: 'Bliss Rent <noreply@bliss.rent>' },
    siteBaseUrl: 'https://bliss.rent',
    bookingId: 'b1',
    eventType: 'admin_booking_received' as const,
    language: 'en' as const,
    dashboardPath: '/admin/bookings/b1',
    sendEmail: vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' })),
    ...overrides,
  }
}

describe('triggerAdminOperationalEmail', () => {
  it('never throws when the booking row cannot be found', async () => {
    const params = baseParams({ dataSource: fakeDataSource(null) as never })
    await expect(triggerAdminOperationalEmail(params)).resolves.toBeUndefined()
    expect(params.emailLog.insertIfNew).not.toHaveBeenCalled()
  })

  it('never throws when there are no active admins to resolve', async () => {
    const params = baseParams({ dataSource: fakeDataSource(bookingRow, []) as never })
    await expect(triggerAdminOperationalEmail(params)).resolves.toBeUndefined()
    expect(params.emailLog.insertIfNew).not.toHaveBeenCalled()
  })

  it('never throws when the admin email lookup itself errors', async () => {
    const params = baseParams({
      getAdminEmail: vi.fn(async () => {
        throw new Error('auth.admin.getUserById failed')
      }),
    })
    await expect(triggerAdminOperationalEmail(params)).resolves.toBeUndefined()
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
    await expect(triggerAdminOperationalEmail(params)).resolves.toBeUndefined()
  })

  it('never throws when the send itself fails — the failure is recorded, not propagated', async () => {
    const params = baseParams({ sendEmail: vi.fn(async () => ({ ok: false, errorMessage: 'Resend API error 500' })) })
    await expect(triggerAdminOperationalEmail(params)).resolves.toBeUndefined()
    expect(params.emailLog.markFailed).toHaveBeenCalledWith('log-1', 'Resend API error 500')
  })

  it('sends to every resolved active admin for a successful lookup', async () => {
    const params = baseParams({
      dataSource: fakeDataSource(bookingRow, [
        { id: 'admin-1', full_name: 'Aisha Owner' },
        { id: 'admin-2', full_name: 'Karim Staff' },
      ]) as never,
      getAdminEmail: vi.fn(async (id: string) => (id === 'admin-1' ? 'owner@example.com' : 'staff@example.com')),
    })
    await triggerAdminOperationalEmail(params)
    expect(params.sendEmail).toHaveBeenCalledTimes(2)
  })
})
