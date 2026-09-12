import { describe, it, expect, vi } from 'vitest'
import {
  fetchExtensionBookingIds,
  fetchBookingNotifications,
  ExtensionNotFoundError,
  type ExtensionRecordSource,
  type BookingNotificationsSource,
  type BookingNotificationRow,
} from './extensionNotificationData.ts'

function fakeExtensionSource(result: { id: string; booking_id: string; conflict_booking_id: string | null } | null): ExtensionRecordSource {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: result, error: null }),
        }),
      }),
    }),
  }
}

describe('fetchExtensionBookingIds', () => {
  it('returns the extension booking id and null conflict id when there is no reassignment', async () => {
    const source = fakeExtensionSource({ id: 'ext-1', booking_id: 'b1', conflict_booking_id: null })
    const result = await fetchExtensionBookingIds(source, 'ext-1')
    expect(result).toEqual({ bookingId: 'b1', conflictBookingId: null })
  })

  it('returns both the extension booking id and the conflict booking id when a reassignment happened', async () => {
    const source = fakeExtensionSource({ id: 'ext-1', booking_id: 'b1', conflict_booking_id: 'b2' })
    const result = await fetchExtensionBookingIds(source, 'ext-1')
    expect(result).toEqual({ bookingId: 'b1', conflictBookingId: 'b2' })
  })

  it('throws ExtensionNotFoundError rather than returning a falsy value when the extension does not exist', async () => {
    const source = fakeExtensionSource(null)
    await expect(fetchExtensionBookingIds(source, 'missing')).rejects.toBeInstanceOf(ExtensionNotFoundError)
  })

  it('throws ExtensionNotFoundError on a database error too', async () => {
    const source: ExtensionRecordSource = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: 'connection reset' } }),
          }),
        }),
      }),
    }
    await expect(fetchExtensionBookingIds(source, 'ext-1')).rejects.toBeInstanceOf(ExtensionNotFoundError)
  })
})

function fakeNotificationsSource(rows: BookingNotificationRow[]): { source: BookingNotificationsSource; inSpy: ReturnType<typeof vi.fn> } {
  const inSpy = vi.fn((_col: string, _ids: string[]) => ({
    order: (_col2: string, _opts: unknown) => ({
      limit: async (_n: number) => ({ data: rows, error: null }),
    }),
  }))
  const source: BookingNotificationsSource = {
    from: () => ({ select: () => ({ in: inSpy }) }) as never,
  }
  return { source, inSpy }
}

describe('fetchBookingNotifications', () => {
  const row: BookingNotificationRow = {
    id: 'n1',
    booking_id: 'b1',
    notification_type: 'extension_approved',
    payload: { extension_days: 2 },
    created_at: '2026-09-01T00:00:00Z',
  }

  it('returns an empty array without querying when given no booking ids', async () => {
    const { source, inSpy } = fakeNotificationsSource([row])
    const result = await fetchBookingNotifications(source, [])
    expect(result).toEqual([])
    expect(inSpy).not.toHaveBeenCalled()
  })

  it('dedupes booking ids before querying (e.g. bookingId === conflictBookingId edge case)', async () => {
    const { source, inSpy } = fakeNotificationsSource([row])
    await fetchBookingNotifications(source, ['b1', 'b1', 'b1'])
    expect(inSpy).toHaveBeenCalledWith('booking_id', ['b1'])
  })

  it('filters out falsy booking ids (e.g. a null conflictBookingId passed through unfiltered by the caller)', async () => {
    const { source, inSpy } = fakeNotificationsSource([row])
    await fetchBookingNotifications(source, ['b1', null as unknown as string, undefined as unknown as string])
    expect(inSpy).toHaveBeenCalledWith('booking_id', ['b1'])
  })

  it('returns the rows from the query', async () => {
    const { source } = fakeNotificationsSource([row])
    const result = await fetchBookingNotifications(source, ['b1'])
    expect(result).toEqual([row])
  })

  it('returns an empty array (not null) when the query finds nothing', async () => {
    const source: BookingNotificationsSource = {
      from: () => ({ select: () => ({ in: () => ({ order: () => ({ limit: async () => ({ data: null, error: null }) }) }) }) }) as never,
    }
    const result = await fetchBookingNotifications(source, ['b1'])
    expect(result).toEqual([])
  })

  it('throws on a database error', async () => {
    const source: BookingNotificationsSource = {
      from: () => ({ select: () => ({ in: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: 'timeout' } }) }) }) }) }) as never,
    }
    await expect(fetchBookingNotifications(source, ['b1'])).rejects.toThrow(/timeout/)
  })
})
