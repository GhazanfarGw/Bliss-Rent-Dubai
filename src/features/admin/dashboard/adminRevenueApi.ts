import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'
import type { RevenuePayment } from '@/lib/revenueAnalytics'

/**
 * Every paid payment, flattened to exactly what the Revenue section's
 * charts need (see revenueAnalytics.ts for the aggregation math). Paid
 * payments only — pending/failed payments carry no `paid_at` and don't
 * represent real revenue.
 */
export async function fetchRevenuePayments(): Promise<RevenuePayment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('amount, paid_at, bookings(vehicles(make, model, vehicle_categories(name)))')
    .eq('status', 'paid')
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: true })

  if (error) throw new AdminApiError(error.message)

  type Row = {
    amount: number
    paid_at: string | null
    bookings: {
      vehicles: {
        make: string
        model: string
        vehicle_categories: { name: string } | null
      } | null
    } | null
  }

  return ((data ?? []) as unknown as Row[])
    .filter((r): r is Row & { paid_at: string } => r.paid_at != null)
    .map((r) => {
      const vehicle = r.bookings?.vehicles ?? null
      return {
        amount: r.amount,
        paidAt: r.paid_at,
        categoryName: vehicle?.vehicle_categories?.name ?? null,
        vehicleLabel: vehicle ? `${vehicle.make} ${vehicle.model}` : null,
      }
    })
}
