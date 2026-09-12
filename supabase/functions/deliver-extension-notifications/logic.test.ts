import { describe, it, expect, vi } from 'vitest'
import {
  handleDeliverExtensionNotifications,
  DeliverExtensionNotificationsError,
  type DeliverExtensionNotificationsDeps,
} from './logic.ts'
import type { BookingEmailRow } from '../_shared/email/bookingEmailData.ts'

const bookingRow: BookingEmailRow = {
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
}

function fakeDeps(overrides: Partial<DeliverExtensionNotificationsDeps> = {}): DeliverExtensionNotificationsDeps {
  return {
    getCallerUserId: vi.fn(async () => 'admin-1'),
    getCallerProfile: vi.fn(async () => ({ role: 'staff', is_active: true })),
    dataSource: {
      from: (table: string) => {
        if (table === 'booking_extensions') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: 'ext-1', booking_id: 'b1', conflict_booking_id: null }, error: null }),
              }),
            }),
          }
        }
        if (table === 'booking_notifications') {
          return {
            select: () => ({
              in: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [{ id: 'n1', booking_id: 'b1', notification_type: 'extension_approved', payload: {}, created_at: '2026-09-01T00:00:00Z' }],
                    error: null,
                  }),
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

const VALID_BODY = { extensionId: 'ext-1' }

describe('handleDeliverExtensionNotifications', () => {
  it('rejects a missing Authorization header without checking anything else', async () => {
    const deps = fakeDeps()
    await expect(handleDeliverExtensionNotifications(null, VALID_BODY, deps)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(deps.getCallerUserId).not.toHaveBeenCalled()
  })

  it('rejects an expired/invalid access token', async () => {
    const deps = fakeDeps({ getCallerUserId: vi.fn(async () => null) })
    await expect(handleDeliverExtensionNotifications('Bearer bad', VALID_BODY, deps)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('rejects a caller with no admin_profiles row', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => null) })
    await expect(handleDeliverExtensionNotifications('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a suspended admin caller', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => ({ role: 'staff', is_active: false })) })
    await expect(handleDeliverExtensionNotifications('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a non-admin role', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => ({ role: 'customer', is_active: true })) })
    await expect(handleDeliverExtensionNotifications('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a missing extensionId', async () => {
    const deps = fakeDeps()
    await expect(handleDeliverExtensionNotifications('Bearer t', {}, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { extensionId: expect.any(String) },
    })
  })

  it('maps an unknown extensionId to EXTENSION_NOT_FOUND', async () => {
    const deps = fakeDeps({
      dataSource: {
        from: (table: string) => {
          if (table === 'booking_extensions') {
            return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
          }
          throw new Error(`unexpected table: ${table}`)
        },
      } as never,
    })
    await expect(handleDeliverExtensionNotifications('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'EXTENSION_NOT_FOUND' })
  })

  it('defaults language to en for anything other than the literal "ar"', async () => {
    const deps = fakeDeps()
    let capturedIsRtl = false
    deps.sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedIsRtl = params.html.includes('dir="rtl"')
      return { ok: true, providerMessageId: 'msg-1' }
    })
    await handleDeliverExtensionNotifications('Bearer t', { extensionId: 'ext-1', language: 'fr' }, deps)
    expect(capturedIsRtl).toBe(false)
  })

  it('honors an explicit language: "ar"', async () => {
    const deps = fakeDeps()
    let capturedIsRtl = false
    deps.sendEmail = vi.fn(async (_config, params: { html: string }) => {
      capturedIsRtl = params.html.includes('dir="rtl"')
      return { ok: true, providerMessageId: 'msg-1' }
    })
    await handleDeliverExtensionNotifications('Bearer t', { extensionId: 'ext-1', language: 'ar' }, deps)
    expect(capturedIsRtl).toBe(true)
  })

  it('returns the delivery outcomes for a valid admin-triggered request', async () => {
    const deps = fakeDeps()
    const result = await handleDeliverExtensionNotifications('Bearer t', VALID_BODY, deps)
    expect(result.outcomes).toEqual([
      { notificationId: 'n1', bookingId: 'b1', notificationType: 'extension_approved', status: 'sent', emailLogId: 'log-1', providerMessageId: 'msg-1' },
    ])
  })

  it('returns an empty outcomes array when the extension has no pending notifications, rather than erroring', async () => {
    const deps = fakeDeps({
      dataSource: {
        from: (table: string) => {
          if (table === 'booking_extensions') {
            return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'ext-1', booking_id: 'b1', conflict_booking_id: null }, error: null }) }) }) }
          }
          if (table === 'booking_notifications') {
            return { select: () => ({ in: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }
          }
          throw new Error(`unexpected table: ${table}`)
        },
      } as never,
    })
    const result = await handleDeliverExtensionNotifications('Bearer t', VALID_BODY, deps)
    expect(result.outcomes).toEqual([])
  })

  it('is an instance of DeliverExtensionNotificationsError on every rejection path', async () => {
    const deps = fakeDeps({ getCallerUserId: vi.fn(async () => null) })
    await expect(handleDeliverExtensionNotifications('Bearer t', VALID_BODY, deps)).rejects.toBeInstanceOf(DeliverExtensionNotificationsError)
  })
})
