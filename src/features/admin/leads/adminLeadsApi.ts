import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'

export const LEAD_STATUSES = ['new', 'quoted', 'booked', 'lost'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

/** public.leads row (20261019000000_marketing_leads_and_attribution.sql). */
export interface AdminLeadRow {
  id: string
  created_at: string
  source: string
  source_code: string | null
  full_name: string | null
  phone: string | null
  email: string | null
  car_interest: string | null
  vehicle_id: string | null
  start_date: string | null
  end_date: string | null
  status: LeadStatus
  estimated_value: number | null
  currency: string
  utm_campaign: string | null
  notes: string | null
}

/** Admin-only via RLS (leads_admin_all → is_admin()). Newest first. */
export async function fetchLeads(): Promise<AdminLeadRow[]> {
  const { data, error } = await supabase
    .from('leads' as never)
    .select('id, created_at, source, source_code, full_name, phone, email, car_interest, vehicle_id, start_date, end_date, status, estimated_value, currency, utm_campaign, notes')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new AdminApiError(error.message)
  return (data ?? []) as unknown as AdminLeadRow[]
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<void> {
  const { error } = await supabase.from('leads' as never).update({ status } as never).eq('id', id)
  if (error) throw new AdminApiError(error.message)
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from('leads' as never).delete().eq('id', id)
  if (error) throw new AdminApiError(error.message)
}
