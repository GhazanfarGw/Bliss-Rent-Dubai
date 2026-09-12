// Task 3 — the real ComplaintReplyEmailLogStore, backed by the same
// email_log table from Phase 9C ('customer' recipient_type and a
// nullable booking_id are already valid there). Mirrors
// supabaseAdminEmailLogStore.ts / supabaseEmailLogStore.ts exactly, just
// typed against ComplaintReplyEmailLogInsertRow.

import type {
  ComplaintReplyEmailLogInsertRow,
  ComplaintReplyEmailLogInsertResult,
  ComplaintReplyEmailLogStore,
} from './sendComplaintReplyEmail.ts'

export interface ComplaintReplyEmailLogSupabaseClient {
  from(table: 'email_log'): {
    upsert(
      row: ComplaintReplyEmailLogInsertRow,
      options: { onConflict: string; ignoreDuplicates: true },
    ): {
      select(columns: string): {
        maybeSingle(): Promise<{ data: { id: string } | null; error: { message: string } | null }>
      }
    }
    update(
      values: Record<string, unknown>,
    ): {
      eq(column: string, value: string): Promise<{ error: { message: string } | null }>
    }
  }
}

export function createSupabaseComplaintReplyEmailLogStore(
  supabase: ComplaintReplyEmailLogSupabaseClient,
): ComplaintReplyEmailLogStore {
  return {
    async insertIfNew(row: ComplaintReplyEmailLogInsertRow): Promise<ComplaintReplyEmailLogInsertResult> {
      const { data, error } = await supabase
        .from('email_log')
        .upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: true })
        .select('id')
        .maybeSingle()

      if (error) {
        throw new Error(`email_log insertIfNew (complaint reply) failed: ${error.message}`)
      }
      if (!data) {
        return { inserted: false, id: null }
      }
      return { inserted: true, id: data.id }
    },

    async markSent(id: string, providerMessageId: string | undefined): Promise<void> {
      const { error } = await supabase
        .from('email_log')
        .update({ status: 'sent', provider_message_id: providerMessageId ?? null, sent_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(`email_log markSent (complaint reply) failed: ${error.message}`)
    },

    async markFailed(id: string, failureReason: string): Promise<void> {
      const { error } = await supabase
        .from('email_log')
        .update({ status: 'failed', failure_reason: failureReason })
        .eq('id', id)
      if (error) throw new Error(`email_log markFailed (complaint reply) failed: ${error.message}`)
    },
  }
}
