import { supabase } from '@/lib/supabaseClient'
import type { ExtensionPricingSettings } from '@/lib/extensionPricing'
import type { ExtensionPenaltySettings } from '@/lib/extensionPenalty'
import type { Database } from '@/types/database'

type PricingRow = Database['public']['Tables']['pricing']['Row']

/**
 * 2026-09-05 — extension price-preview feature (see AskUserQuestion
 * decision recorded in claude/ project docs). Backs the "estimated added
 * cost / new total" preview shown to a customer BEFORE they submit an
 * extension request, in both ExtendRentalSection.tsx and
 * ManageBookingVerifyPanel.tsx.
 *
 * This deliberately does NOT introduce a second pricing engine: it only
 * fetches the two pieces of data the existing, unchanged
 * computeExtensionAmount()/computeExtensionPenalty() (src/lib/extensionPricing.ts,
 * src/lib/extensionPenalty.ts) need that weren't previously readable from
 * the browser —
 *   1. which pricing/penalty policy is actually configured right now
 *      (get_extension_estimate_config(), a new narrow public RPC — see
 *      supabase/migrations/20260918000000_extension_price_preview_and_email_breakdown.sql),
 *   2. the vehicle's current daily rate (the `pricing` table, already
 *      public — same read create-booking/logic.ts already does for the
 *      original booking price).
 * Both computeExtensionAmount and computeExtensionPenalty already throw
 * (rather than guess) when a policy or rate isn't configured — callers
 * here treat that the same way: no estimate shown, request still
 * submittable, since the server is the actual authority.
 */
export async function fetchExtensionEstimateConfig(): Promise<{
  pricing: ExtensionPricingSettings
  penalty: ExtensionPenaltySettings
}> {
  const { data, error } = await supabase.rpc('get_extension_estimate_config')
  if (error) throw new Error(error.message)
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        pricing_policy: ExtensionPricingSettings['policy']
        custom_daily_rate: number | null
        custom_currency: string
        penalty_policy: ExtensionPenaltySettings['policy']
        penalty_fixed_fee: number | null
        penalty_per_day: number | null
        penalty_percentage_rate: number | null
        penalty_currency: string
      }
    | undefined

  return {
    pricing: {
      policy: row?.pricing_policy ?? null,
      customDailyRate: row?.custom_daily_rate ?? null,
      customCurrency: row?.custom_currency ?? 'AED',
    },
    penalty: {
      policy: row?.penalty_policy ?? null,
      fixedFeeAmount: row?.penalty_fixed_fee ?? null,
      perDayAmount: row?.penalty_per_day ?? null,
      percentageRate: row?.penalty_percentage_rate ?? null,
      currency: row?.penalty_currency ?? 'AED',
    },
  }
}

/** Same public `pricing` table read as create-booking/logic.ts — only the vehicle's own rows, not exposed anywhere new. */
export async function fetchVehiclePricingRows(vehicleId: string): Promise<PricingRow[]> {
  const { data, error } = await supabase
    .from('pricing')
    .select('id, vehicle_id, term, list_price, client_price, currency, created_at')
    .eq('vehicle_id', vehicleId)
  if (error) throw new Error(error.message)
  return data ?? []
}
