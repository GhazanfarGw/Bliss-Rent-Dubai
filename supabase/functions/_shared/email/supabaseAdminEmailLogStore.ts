// Phase 9F — the real AdminEmailLogStore, backed by the SAME email_log
// table from Phase 9C (recipient_type='admin' is already a valid value
// under that table's check constraint — see
// supabase/migrations/20260911000000_phase9_email_log_table.sql). This
// mirrors 9D's supabaseEmailLogStore.ts exactly, just typed against
// AdminEmailLogInsertRow instead of modifying that file to widen its
// `recipient_type: 'customer'` literal — see sendAdminOperationalEmail.ts's
// file header for why a parallel file was chosen over a shared one.

import type { AdminEmailLogInsertRow, AdminEmailLogInsertResult, AdminEmailLogStore } from './sendAdminOperationalEmail.ts'

export interface AdminEmailLogSupabaseClient {
  from(table: 'email_log'): {
    upsert(
      row: AdminEmailLogInsertRow,
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

export function createSupabaseAdminEmailLogStore(supabase: AdminEmailLogSupabaseClient): AdminEmailLogStore {
  return {
    async insertIfNew(row: AdminEmailLogInsertRow): Promise<AdminEmailLogInsertResult> {
      const { data, error } = await supabase
        .from('email_log')
        .upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: true })
        .select('id')
        .maybeSingle()

      if (error) {
        throw new Error(`email_log insertIfNew (admin) failed: ${error.message}`)
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
      if (error) throw new Error(`email_log markSent (admin) failed: ${error.message}`)
    },

    async markFailed(id: string, failureReason: string): Promise<void> {
      const { error } = await supabase
        .from('email_log')
        .update({ status: 'failed', failure_reason: failureReason })
        .eq('id', id)
      if (error) throw new Error(`email_log markFailed (admin) failed: ${error.message}`)
    },
  }
}
