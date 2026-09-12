import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'
import type { Database } from '@/types/database'

type BookingRow = Database['public']['Tables']['bookings']['Row']

export interface CalendarBooking {
  id: string
  start_date: string
  end_date: string
  status: BookingRow['status']
  customer_name: string
}

/**
 * A plain, direct read of `bookings` for one vehicle in a date window —
 * admins have full RLS read access to bookings (Phase 0's "admins manage
 * bookings" policy), so this is just displaying existing reservation
 * periods, not a second availability calculation. The customer-facing
 * "is this vehicle bookable for dates X–Y" question remains answered
 * exclusively by available_vehicles() in src/features/booking/api.ts.
 */
export async function fetchVehicleBookingsInRange(
  vehicleId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<CalendarBooking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, start_date, end_date, status, customers(full_name)')
    .eq('vehicle_id', vehicleId)
    .neq('status', 'cancelled')
    .lte('start_date', rangeEnd)
    .gte('end_date', rangeStart)
    .order('start_date')

  if (error) throw new AdminApiError(error.message)

  type Row = { id: string; start_date: string; end_date: string; status: BookingRow['status']; customers: { full_name: string } | null }
  return ((data ?? []) as unknown as Row[]).map((b) => ({
    id: b.id,
    start_date: b.start_date,
    end_date: b.end_date,
    status: b.status,
    customer_name: b.customers?.full_name ?? '—',
  }))
}
