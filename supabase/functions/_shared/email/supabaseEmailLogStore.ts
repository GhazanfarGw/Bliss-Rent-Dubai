// Phase 9D — the real EmailLogStore, backed by the email_log table from
// Phase 9C. This is the ONLY file that talks to email_log directly; the
// orchestration in sendCustomerBookingEmail.ts only knows the
// EmailLogStore interface, which is what keeps that file unit-testable
// without a real database.
//
// `insertIfNew` is a SINGLE `upsert(..., { ignoreDuplicates: true })`
// call — supabase-js compiles this to one `INSERT ... ON CONFLICT
// (idempotency_key) DO NOTHING` statement against
// email_log_idempotency_key_idx (Phase 9C). There is no separate
// existence check beforehand — see sendCustomerBookingEmail.ts's file
// header for why that matters under concurrency. When the row already
// exists, Postgres does nothing and returns no row, which is why
// `.select()` comes back empty on a duplicate rather than erroring.

import type { EmailLogInsertRow, EmailLogInsertResult, EmailLogStore } from './sendCustomerBookingEmail.ts'

export interface EmailLogSupabaseClient {
  from(table: 'email_log'): {
    upsert(
      row: EmailLogInsertRow,
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

export function createSupabaseEmailLogStore(supabase: EmailLogSupabaseClient): EmailLogStore {
  return {
    async insertIfNew(row: EmailLogInsertRow): Promise<EmailLogInsertResult> {
      const { data, error } = await supabase
        .from('email_log')
        .upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: true })
        .select('id')
        .maybeSingle()

      if (error) {
        throw new Error(`email_log insertIfNew failed: ${error.message}`)
      }
      if (!data) {
        // No row returned == the idempotency key already existed and the
        // conflict was ignored, exactly as intended — not an error.
        return { inserted: false, id: null }
      }
      return { inserted: true, id: data.id }
    },

    async markSent(id: string, providerMessageId: string | undefined): Promise<void> {
      const { error } = await supabase
        .from('email_log')
        .update({ status: 'sent', provider_message_id: providerMessageId ?? null, sent_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(`email_log markSent failed: ${error.message}`)
    },

    async markFailed(id: string, failureReason: string): Promise<void> {
      const { error } = await supabase
        .from('email_log')
        .update({ status: 'failed', failure_reason: failureReason })
        .eq('id', id)
      if (error) throw new Error(`email_log markFailed failed: ${error.message}`)
    },
  }
}
