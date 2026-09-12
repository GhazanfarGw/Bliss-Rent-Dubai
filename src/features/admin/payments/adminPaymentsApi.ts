import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'
import type { AdminPaymentWithDetails } from '@/types/domain'
import type { Database } from '@/types/database'

type PaymentStatus = Database['public']['Tables']['payments']['Row']['status']

/**
 * Read-only by design. Phase 2's confirm-payment Edge Function + TEST
 * ONLY provider remain the sole writer of payment state — this page does
 * not add a second payment system or a raw client-side status edit, per
 * the Phase 3 brief ("do NOT create a second payment system").
 */
export async function fetchPayments(status: PaymentStatus | 'all'): Promise<AdminPaymentWithDetails[]> {
  let query = supabase
    .from('payments')
    .select('*, bookings(*, customers(*))')
    .order('created_at', { ascending: false })
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new AdminApiError(error.message)
  return (data ?? []) as unknown as AdminPaymentWithDetails[]
}
