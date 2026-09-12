import { describe, it, expect, vi } from 'vitest'
import {
  handleNotifyAdminBookingCancelled,
  NotifyAdminBookingCancelledError,
  type NotifyAdminBookingCancelledDeps,
} from './logic.ts'
import type { BookingEmailRow } from '../_shared/email/bookingEmailData.ts'

const bookingRow: BookingEmailRow = {
  id: 'b1',
  status: 'cancelled',
  start_date: '2026-09-10',
  end_date: '2026-09-20',
  total_price: 1000,
  currency: 'AED',
  customers: { full_name: 'Jane Renter', email: 'jane@example.com' },
  vehicles: { make: 'Toyota', model: 'Camry' },
  pickup_location: { name: 'DXB Terminal 3' },
  dropoff_location: { name: 'DXB Terminal 3' },
}

function fakeDeps(overrides: Partial<NotifyAdminBookingCancelledDeps> = {}): NotifyAdminBookingCancelledDeps {
  return {
    getCallerUserId: vi.fn(async () => 'admin-1'),
    getCallerProfile: vi.fn(async () => ({ role: 'staff', is_active: true })),
    dataSource: {
      from: (table: string) => {
        if (table === 'bookings') {
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: bookingRow, error: null }) }) }) }
        }
        if (table === 'admin_profiles') {
          return { select: () => ({ eq: async () => ({ data: [{ id: 'admin-1', full_name: 'Aisha Owner' }], error: null }) }) }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    } as never,
    getAdminEmail: vi.fn(async () => 'owner@example.com'),
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

const VALID_BODY = { bookingId: 'b1' }

describe('handleNotifyAdminBookingCancelled', () => {
  it('rejects a missing Authorization header without checking anything else', async () => {
    const deps = fakeDeps()
    await expect(handleNotifyAdminBookingCancelled(null, VALID_BODY, deps)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(deps.getCallerUserId).not.toHaveBeenCalled()
  })

  it('rejects an expired/invalid access token', async () => {
    const deps = fakeDeps({ getCallerUserId: vi.fn(async () => null) })
    await expect(handleNotifyAdminBookingCancelled('Bearer bad', VALID_BODY, deps)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('rejects a caller with no admin_profiles row', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => null) })
    await expect(handleNotifyAdminBookingCancelled('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a suspended admin caller', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => ({ role: 'staff', is_active: false })) })
    await expect(handleNotifyAdminBookingCancelled('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a non-admin role', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => ({ role: 'customer', is_active: true })) })
    await expect(handleNotifyAdminBookingCancelled('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a missing bookingId', async () => {
    const deps = fakeDeps()
    await expect(handleNotifyAdminBookingCancelled('Bearer t', {}, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { bookingId: expect.any(String) },
    })
  })

  it('maps an unknown bookingId to BOOKING_NOT_FOUND', async () => {
    const deps = fakeDeps({
      dataSource: {
        from: (table: string) => {
          if (table === 'bookings') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
          if (table === 'admin_profiles') return { select: () => ({ eq: async () => ({ data: [], error: null }) }) }
          throw new Error(`unexpected table: ${table}`)
        },
      } as never,
    })
    await expect(handleNotifyAdminBookingCancelled('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'BOOKING_NOT_FOUND' })
  })

  it('returns the delivery outcomes for a valid admin-triggered request', async () => {
    const deps = fakeDeps()
    const result = await handleNotifyAdminBookingCancelled('Bearer t', VALID_BODY, deps)
    expect(result.outcomes).toEqual([
      { recipientEmail: 'owner@example.com', status: 'sent', emailLogId: 'log-1', providerMessageId: 'msg-1' },
    ])
  })

  it('returns an empty outcomes array when there are no active admins, rather than erroring', async () => {
    const deps = fakeDeps({
      dataSource: {
        from: (table: string) => {
          if (table === 'bookings') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: bookingRow, error: null }) }) }) }
          if (table === 'admin_profiles') return { select: () => ({ eq: async () => ({ data: [], error: null }) }) }
          throw new Error(`unexpected table: ${table}`)
        },
      } as never,
    })
    const result = await handleNotifyAdminBookingCancelled('Bearer t', VALID_BODY, deps)
    expect(result.outcomes).toEqual([])
  })

  it('is an instance of NotifyAdminBookingCancelledError on every rejection path', async () => {
    const deps = fakeDeps({ getCallerUserId: vi.fn(async () => null) })
    await expect(handleNotifyAdminBookingCancelled('Bearer t', VALID_BODY, deps)).rejects.toBeInstanceOf(NotifyAdminBookingCancelledError)
  })
})
