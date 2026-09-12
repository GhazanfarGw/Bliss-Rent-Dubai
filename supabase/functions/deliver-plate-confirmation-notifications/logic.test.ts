import { describe, it, expect, vi } from 'vitest'
import {
  handleDeliverPlateConfirmationNotifications,
  DeliverPlateConfirmationNotificationsError,
  type DeliverPlateConfirmationNotificationsDeps,
} from './logic.ts'
import type { BookingEmailRow } from '../_shared/email/bookingEmailData.ts'

const bookingRow: BookingEmailRow = {
  id: 'b1',
  status: 'confirmed',
  start_date: '2026-10-01',
  end_date: '2026-10-05',
  total_price: 1500,
  currency: 'AED',
  customers: { full_name: 'Jane Renter', email: 'jane@example.com' },
  vehicles: { make: 'Nissan', model: 'Sentra' },
  pickup_location: { name: 'DXB Terminal 1' },
  dropoff_location: { name: 'DXB Terminal 1' },
}

const notificationRow = {
  id: 'notif-1',
  booking_id: 'b1',
  notification_type: 'plate_confirmed',
  payload: { booking_reference: 'BLS-ABCDEF12', plate_number: 'BLS-NEW-9001', make: 'Nissan', model: 'Sentra' },
  created_at: '2026-09-07T00:00:00Z',
}

function fakeDeps(overrides: Partial<DeliverPlateConfirmationNotificationsDeps> = {}): DeliverPlateConfirmationNotificationsDeps {
  return {
    getCallerUserId: vi.fn(async () => 'admin-1'),
    getCallerProfile: vi.fn(async () => ({ role: 'super_admin', is_active: true })),
    dataSource: {
      from: (table: string) => {
        if (table === 'booking_notifications') {
          return {
            select: () => ({
              in: () => ({
                order: () => ({
                  limit: async () => ({ data: [notificationRow], error: null }),
                }),
              }),
            }),
          }
        }
        if (table === 'bookings') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: bookingRow, error: null }),
              }),
            }),
          }
        }
        throw new Error(`unexpected table: ${table}`)
      },
    } as never,
    whatsappSource: {
      from: () => ({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: { id: 'notif-1' }, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as never,
    getEnv: vi.fn(() => undefined),
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

describe('handleDeliverPlateConfirmationNotifications', () => {
  it('rejects a missing Authorization header without checking anything else', async () => {
    const deps = fakeDeps()
    await expect(handleDeliverPlateConfirmationNotifications(null, VALID_BODY, deps)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(deps.getCallerUserId).not.toHaveBeenCalled()
  })

  it('rejects an expired/invalid access token', async () => {
    const deps = fakeDeps({ getCallerUserId: vi.fn(async () => null) })
    await expect(handleDeliverPlateConfirmationNotifications('Bearer bad', VALID_BODY, deps)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('rejects a caller with no admin_profiles row', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => null) })
    await expect(handleDeliverPlateConfirmationNotifications('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a suspended admin caller', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => ({ role: 'staff', is_active: false })) })
    await expect(handleDeliverPlateConfirmationNotifications('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a non-admin role', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => ({ role: 'customer', is_active: true })) })
    await expect(handleDeliverPlateConfirmationNotifications('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a missing bookingId', async () => {
    const deps = fakeDeps()
    await expect(handleDeliverPlateConfirmationNotifications('Bearer t', {}, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { bookingId: expect.any(String) },
    })
  })

  it('sends the plate_confirmed email and attempts WhatsApp dispatch for a valid admin-triggered request', async () => {
    const deps = fakeDeps()
    const result = await handleDeliverPlateConfirmationNotifications('Bearer t', VALID_BODY, deps)
    expect(result.emailOutcomes).toEqual([{ notificationId: 'notif-1', bookingId: 'b1', status: 'sent', emailLogId: 'log-1', providerMessageId: 'msg-1' }])
    expect(result.whatsappOutcomes).toEqual([{ notificationId: 'notif-1', outcome: { status: 'not_configured' } }])
  })

  it('returns empty outcomes when the booking has no plate_confirmed notification yet, rather than erroring', async () => {
    const deps = fakeDeps({
      dataSource: {
        from: (table: string) => {
          if (table === 'booking_notifications') {
            return { select: () => ({ in: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }
          }
          throw new Error(`unexpected table: ${table}`)
        },
      } as never,
    })
    const result = await handleDeliverPlateConfirmationNotifications('Bearer t', VALID_BODY, deps)
    expect(result.emailOutcomes).toEqual([])
    expect(result.whatsappOutcomes).toEqual([])
  })

  it('reports WhatsApp as sent/dispatched only when a provider is configured (still not a real vendor call in this codebase)', async () => {
    const deps = fakeDeps({ getEnv: vi.fn((name: string) => (name === 'WHATSAPP_PROVIDER' ? 'some-vendor' : undefined)) })
    const result = await handleDeliverPlateConfirmationNotifications('Bearer t', VALID_BODY, deps)
    expect(result.whatsappOutcomes).toEqual([
      { notificationId: 'notif-1', outcome: { status: 'failed', errorMessage: expect.stringContaining('not a recognized/implemented provider') } },
    ])
  })

  it('is an instance of DeliverPlateConfirmationNotificationsError on every rejection path', async () => {
    const deps = fakeDeps({ getCallerUserId: vi.fn(async () => null) })
    await expect(handleDeliverPlateConfirmationNotifications('Bearer t', VALID_BODY, deps)).rejects.toBeInstanceOf(DeliverPlateConfirmationNotificationsError)
  })
})
