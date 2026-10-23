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
