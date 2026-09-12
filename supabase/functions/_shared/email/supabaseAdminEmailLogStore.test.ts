import { describe, it, expect, vi } from 'vitest'
import { createSupabaseAdminEmailLogStore, type AdminEmailLogSupabaseClient } from './supabaseAdminEmailLogStore.ts'
import type { AdminEmailLogInsertRow } from './sendAdminOperationalEmail.ts'

const row: AdminEmailLogInsertRow = {
  idempotency_key: 'booking:b1:admin_booking_confirmed:admin-1',
  booking_id: 'b1',
  event_type: 'admin_booking_confirmed',
  recipient_type: 'admin',
  recipient_email: 'owner@example.com',
  language: 'en',
  template: 'admin_admin_booking_confirmed',
  subject: 'Booking confirmed — payment received — Bliss Rent',
}

function fakeClient(overrides: Partial<{ upsertResult: { data: { id: string } | null; error: { message: string } | null }; updateResult: { error: { message: string } | null } }> = {}): {
  client: AdminEmailLogSupabaseClient
  upsertSpy: ReturnType<typeof vi.fn>
  updateSpy: ReturnType<typeof vi.fn>
} {
  const upsertResult = overrides.upsertResult ?? { data: { id: 'log-1' }, error: null }
  const updateResult = overrides.updateResult ?? { error: null }
  const upsertSpy = vi.fn((_row: AdminEmailLogInsertRow, _opts: unknown) => ({
    select: (_cols: string) => ({
      maybeSingle: async () => upsertResult,
    }),
  }))
  const updateSpy = vi.fn((_values: Record<string, unknown>) => ({
    eq: async (_col: string, _val: string) => updateResult,
  }))

  const client: AdminEmailLogSupabaseClient = {
    from: () => ({ upsert: upsertSpy, update: updateSpy }) as never,
  }
  return { client, upsertSpy, updateSpy }
}

describe('createSupabaseAdminEmailLogStore', () => {
  describe('insertIfNew', () => {
    it('calls upsert with onConflict on idempotency_key and ignoreDuplicates:true — same atomic-statement guarantee as the customer store', async () => {
      const { client, upsertSpy } = fakeClient()
      const store = createSupabaseAdminEmailLogStore(client)
      await store.insertIfNew(row)
      expect(upsertSpy).toHaveBeenCalledWith(row, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    })

    it('returns inserted:true with the new id when a row comes back', async () => {
      const { client } = fakeClient({ upsertResult: { data: { id: 'log-1' }, error: null } })
      const store = createSupabaseAdminEmailLogStore(client)
      expect(await store.insertIfNew(row)).toEqual({ inserted: true, id: 'log-1' })
    })

    it('returns inserted:false (not an error) when no row comes back — the duplicate-key case', async () => {
      const { client } = fakeClient({ upsertResult: { data: null, error: null } })
      const store = createSupabaseAdminEmailLogStore(client)
      expect(await store.insertIfNew(row)).toEqual({ inserted: false, id: null })
    })

    it('throws on a real database error', async () => {
      const { client } = fakeClient({ upsertResult: { data: null, error: { message: 'connection reset' } } })
      const store = createSupabaseAdminEmailLogStore(client)
      await expect(store.insertIfNew(row)).rejects.toThrow(/connection reset/)
    })
  })

  describe('markSent', () => {
    it('updates status to sent with the provider message id', async () => {
      const { client, updateSpy } = fakeClient()
      const store = createSupabaseAdminEmailLogStore(client)
      await store.markSent('log-1', 'msg-123')
      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent', provider_message_id: 'msg-123' }))
    })

    it('stores null provider_message_id when none was returned', async () => {
      const { client, updateSpy } = fakeClient()
      const store = createSupabaseAdminEmailLogStore(client)
      await store.markSent('log-1', undefined)
      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ provider_message_id: null }))
    })

    it('throws on a database error', async () => {
      const { client } = fakeClient({ updateResult: { error: { message: 'timeout' } } })
      const store = createSupabaseAdminEmailLogStore(client)
      await expect(store.markSent('log-1', 'msg-1')).rejects.toThrow(/timeout/)
    })
  })

  describe('markFailed', () => {
    it('updates status to failed with the failure reason', async () => {
      const { client, updateSpy } = fakeClient()
      const store = createSupabaseAdminEmailLogStore(client)
      await store.markFailed('log-1', 'Resend API error 500')
      expect(updateSpy).toHaveBeenCalledWith({ status: 'failed', failure_reason: 'Resend API error 500' })
    })
  })
})
