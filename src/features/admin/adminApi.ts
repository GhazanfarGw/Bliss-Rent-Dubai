import { supabase } from '@/lib/supabaseClient'

export class AdminApiError extends Error {
  /** Per-field validation messages, when the server returned them (currently only admin-create-staff does) — undefined for every other admin*Api.ts call site, which can safely ignore this. */
  fieldErrors?: Record<string, string>

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.fieldErrors = fieldErrors
  }
}

/**
 * Every query in this file (and every other admin*Api.ts file) runs
 * through the same anon-key `supabase` client the rest of the app uses.
 * There is no separate "admin client" and no service-role key here —
 * access is governed entirely by the "admins manage X" RLS policies
 * already defined in supabase/migrations/20260824000000_phase0_foundation.sql,
 * keyed off is_admin(). If a query returns nothing or errors for a
 * non-admin, that is RLS doing its job, not a bug.
 */

export interface DashboardKpis {
  newBookings: number
  confirmedBookings: number
  activeRentals: number
  vehiclesAvailable: number
  vehiclesReserved: number
  vehiclesRented: number
  vehiclesMaintenance: number
  returnsDue: number
  pendingPayments: number
  openComplaints: number
}

/** Every number here comes straight from a count/sum query against real rows — nothing is estimated or hardcoded. */
export async function fetchDashboardKpis(): Promise<DashboardKpis> {
  const todayIso = new Date().toISOString().slice(0, 10)

  const [newBookings, confirmedBookings, activeRentals, returnsDue, pendingPayments, openComplaints, operationalStatuses] =
    await Promise.all([
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending_payment'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'active').lte('end_date', todayIso),
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('vehicle_operational_status').select('operational_status'),
    ])

  for (const res of [newBookings, confirmedBookings, activeRentals, returnsDue, pendingPayments, openComplaints, operationalStatuses]) {
    if (res.error) throw new AdminApiError(res.error.message)
  }

  const statuses = operationalStatuses.data ?? []
  const countStatus = (s: string) => statuses.filter((row) => row.operational_status === s).length

  return {
    newBookings: newBookings.count ?? 0,
    confirmedBookings: confirmedBookings.count ?? 0,
    activeRentals: activeRentals.count ?? 0,
    vehiclesAvailable: countStatus('available'),
    vehiclesReserved: countStatus('reserved'),
    vehiclesRented: countStatus('rented'),
    vehiclesMaintenance: countStatus('maintenance'),
    returnsDue: returnsDue.count ?? 0,
    pendingPayments: pendingPayments.count ?? 0,
    openComplaints: openComplaints.count ?? 0,
  }
}

export interface RecentActivity {
  recentBookings: { id: string; created_at: string; status: string; total_price: number; currency: string; customer_name: string }[]
  recentPayments: { id: string; created_at: string; status: string; amount: number; currency: string; customer_name: string }[]
  recentComplaints: { id: string; created_at: string; status: string; subject: string; customer_name: string }[]
}

export async function fetchRecentActivity(limit = 5): Promise<RecentActivity> {
  const [bookingsRes, paymentsRes, complaintsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, created_at, status, total_price, currency, customers(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('payments')
      .select('id, created_at, status, amount, currency, bookings(customers(full_name))')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('complaints')
      .select('id, created_at, status, subject, customers(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  if (bookingsRes.error) throw new AdminApiError(bookingsRes.error.message)
  if (paymentsRes.error) throw new AdminApiError(paymentsRes.error.message)
  if (complaintsRes.error) throw new AdminApiError(complaintsRes.error.message)

  type BookingActivityRow = { id: string; created_at: string; status: string; total_price: number; currency: string; customers: { full_name: string } | null }
  type PaymentActivityRow = { id: string; created_at: string; status: string; amount: number; currency: string; bookings: { customers: { full_name: string } | null } | null }
  type ComplaintActivityRow = { id: string; created_at: string; status: string; subject: string; customers: { full_name: string } | null }

  return {
    recentBookings: ((bookingsRes.data ?? []) as unknown as BookingActivityRow[]).map((b) => ({
      id: b.id,
      created_at: b.created_at,
      status: b.status,
      total_price: b.total_price,
      currency: b.currency,
      customer_name: b.customers?.full_name ?? '—',
    })),
    recentPayments: ((paymentsRes.data ?? []) as unknown as PaymentActivityRow[]).map((p) => ({
      id: p.id,
      created_at: p.created_at,
      status: p.status,
      amount: p.amount,
      currency: p.currency,
      customer_name: p.bookings?.customers?.full_name ?? '—',
    })),
    recentComplaints: ((complaintsRes.data ?? []) as unknown as ComplaintActivityRow[]).map((c) => ({
      id: c.id,
      created_at: c.created_at,
      status: c.status,
      subject: c.subject,
      customer_name: c.customers?.full_name ?? '—',
    })),
  }
}
