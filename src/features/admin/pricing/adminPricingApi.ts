import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'
import type { PricingDraft } from '@/types/domain'
import type { Database, PricingTerm } from '@/types/database'

type PricingRow = Database['public']['Tables']['pricing']['Row']

export const ALL_TERMS: PricingTerm[] = ['daily', 'weekly', 'monthly', '3_month']

/**
 * Builds one draft row per term for a vehicle, pre-filled from whatever
 * pricing already exists (fetched via adminFleetApi's fetchVehicles /
 * fetchVehicleById, which already embeds `pricing(*)` — reused here rather
 * than re-queried, per "one authoritative pricing calculation, no
 * duplication in the admin frontend").
 */
export function buildPricingDrafts(existing: PricingRow[]): PricingDraft[] {
  return ALL_TERMS.map((term) => {
    const row = existing.find((p) => p.term === term)
    return {
      id: row?.id ?? null,
      term,
      listPrice: row ? String(row.list_price) : '',
      clientPrice: row ? String(row.client_price) : '',
    }
  })
}

/**
 * Upserts the whole ladder for one vehicle in one statement, keyed on the
 * existing (vehicle_id, term) unique constraint. This is a plain
 * RLS-governed write — "admins manage pricing" already covers it — and the
 * pricing_audit trigger (Phase 3 migration) logs each change automatically.
 * Only rows the admin actually filled in (both prices present) are sent;
 * a not-yet-priced term is simply left out of the ladder.
 */
export async function savePricingLadder(vehicleId: string, drafts: PricingDraft[]): Promise<void> {
  const rows = drafts
    .filter((d) => d.listPrice.trim() !== '' && d.clientPrice.trim() !== '')
    .map((d) => ({
      // `id` is deliberately omitted (not even set to `undefined`) when there's
      // no existing row: the upsert already matches on (vehicle_id, term), not
      // id, and merely *setting* the key to `undefined` still tells the
      // Supabase client the row "has" an id column (via Object.keys), which
      // makes PostgREST send an explicit NULL for it instead of leaving it
      // out — defeating the pricing.id default and violating its NOT NULL
      // constraint. Leaving the key out of the object entirely avoids that.
      ...(d.id ? { id: d.id } : {}),
      vehicle_id: vehicleId,
      term: d.term,
      list_price: Number(d.listPrice),
      client_price: Number(d.clientPrice),
    }))

  if (rows.length === 0) return

  const { error } = await supabase.from('pricing').upsert(rows, { onConflict: 'vehicle_id,term' })
  if (error) throw new AdminApiError(error.message)
}
