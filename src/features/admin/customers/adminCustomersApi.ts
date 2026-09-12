import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'
import type { AdminCustomerWithStats, AdminBookingWithDetails } from '@/types/domain'
import type { Database } from '@/types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

/**
 * Booking counts are computed here with a plain per-customer count query
 * (not a stored/duplicated statistic) — small dataset, simple aggregate,
 * same "don't invent numbers" principle as the dashboard KPIs.
 */
export async function fetchCustomers(): Promise<AdminCustomerWithStats[]> {
  const { data: customers, error } = await supabase.from('customers').select('*').order('full_name')
  if (error) throw new AdminApiError(error.message)

  const { data: bookings, error: bookingsError } = await supabase.from('bookings').select('customer_id, status')
  if (bookingsError) throw new AdminApiError(bookingsError.message)

  const counts = new Map<string, { total: number; active: number }>()
  for (const b of bookings ?? []) {
    const entry = counts.get(b.customer_id) ?? { total: 0, active: 0 }
    entry.total += 1
    if (b.status === 'active' || b.status === 'confirmed') entry.active += 1
    counts.set(b.customer_id, entry)
  }

  return (customers ?? []).map((c: CustomerRow) => ({
    ...c,
    booking_count: counts.get(c.id)?.total ?? 0,
    active_booking_count: counts.get(c.id)?.active ?? 0,
  }))
}

export async function fetchCustomerById(id: string): Promise<CustomerRow | null> {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
  if (error) throw new AdminApiError(error.message)
  return data
}

export async function fetchCustomerBookings(customerId: string): Promise<AdminBookingWithDetails[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      '*, customers(*), vehicles(*, vehicle_categories(*)), pickup_location:locations!bookings_pickup_location_id_fkey(*), dropoff_location:locations!bookings_dropoff_location_id_fkey(*), drivers(*), payments(*)',
    )
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw new AdminApiError(error.message)
  return (data ?? []) as unknown as AdminBookingWithDetails[]
}
