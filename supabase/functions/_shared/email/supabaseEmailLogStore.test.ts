import { describe, it, expect, vi } from 'vitest'
import { createSupabaseEmailLogStore, type EmailLogSupabaseClient } from './supabaseEmailLogStore.ts'
import type { EmailLogInsertRow } from './sendCustomerBookingEmail.ts'

const row: EmailLogInsertRow = {
  idempotency_key: 'booking:b1:booking_confirmed',
  booking_id: 'b1',
  event_type: 'booking_confirmed',
  recipient_type: 'customer',
  recipient_email: 'jane@example.com',
  language: 'en',
  template: 'customer_booking_confirmed',
  subject: 'Booking confirmed',
}

function fakeClient(overrides: Partial<{ upsertResult: { data: { id: string } | null; error: { message: string } | null }; updateResult: { error: { message: string } | null } }> = {}): {
  client: EmailLogSupabaseClient
  upsertSpy: ReturnType<typeof vi.fn>
  updateSpy: ReturnType<typeof vi.fn>
} {
  const upsertResult = overrides.upsertResult ?? { data: { id: 'log-1' }, error: null }
  const updateResult = overrides.updateResult ?? { error: null }
  const upsertSpy = vi.fn((_row: EmailLogInsertRow, _opts: unknown) => ({
    select: (_cols: string) => ({
      maybeSingle: async () => upsertResult,
    }),
  }))
  const updateSpy = vi.fn((_values: Record<string, unknown>) => ({
    eq: async (_col: string, _val: string) => updateResult,
  }))

  const client: EmailLogSupabaseClient = {
    from: () => ({ upsert: upsertSpy, update: updateSpy }) as never,
  }
  return { client, upsertSpy, updateSpy }
}

describe('createSupabaseEmailLogStore', () => {
  describe('insertIfNew', () => {
    it('calls upsert with onConflict on idempotency_key and ignoreDuplicates:true — the single atomic statement the concurrency guarantee depends on', async () => {
      const { client, upsertSpy } = fakeClient()
      const store = createSupabaseEmailLogStore(client)
      await store.insertIfNew(row)
      expect(upsertSpy).toHaveBeenCalledWith(row, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    })

    it('returns inserted:true with the new id when a row comes back', async () => {
      const { client } = fakeClient({ upsertResult: { data: { id: 'log-1' }, error: null } })
      const store = createSupabaseEmailLogStore(client)
      expect(await store.insertIfNew(row)).toEqual({ inserted: true, id: 'log-1' })
    })

    it('returns inserted:false (not an error) when no row comes back — the duplicate-key case', async () => {
      const { client } = fakeClient({ upsertResult: { data: null, error: null } })
      const store = createSupabaseEmailLogStore(client)
      expect(await store.insertIfNew(row)).toEqual({ inserted: false, id: null })
    })

    it('throws on a real database error', async () => {
      const { client } = fakeClient({ upsertResult: { data: null, error: { message: 'connection reset' } } })
      const store = createSupabaseEmailLogStore(client)
      await expect(store.insertIfNew(row)).rejects.toThrow(/connection reset/)
    })
  })

  describe('markSent', () => {
    it('updates status to sent with the provider message id', async () => {
      const { client, updateSpy } = fakeClient()
      const store = createSupabaseEmailLogStore(client)
      await store.markSent('log-1', 'msg-123')
      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent', provider_message_id: 'msg-123' }))
    })

    it('stores null provider_message_id when none was returned', async () => {
      const { client, updateSpy } = fakeClient()
      const store = createSupabaseEmailLogStore(client)
      await store.markSent('log-1', undefined)
      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ provider_message_id: null }))
    })

    it('throws on a database error', async () => {
      const { client } = fakeClient({ updateResult: { error: { message: 'timeout' } } })
      const store = createSupabaseEmailLogStore(client)
      await expect(store.markSent('log-1', 'msg-1')).rejects.toThrow(/timeout/)
    })
  })

  describe('markFailed', () => {
    it('updates status to failed with the failure reason', async () => {
      const { client, updateSpy } = fakeClient()
      const store = createSupabaseEmailLogStore(client)
      await store.markFailed('log-1', 'Resend API error 500')
      expect(updateSpy).toHaveBeenCalledWith({ status: 'failed', failure_reason: 'Resend API error 500' })
    })
  })
})
