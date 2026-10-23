import type { Database, PricingTerm } from '@/types/database'

type PricingRow = Database['public']['Tables']['pricing']['Row']

/**
 * Maps a rental length to the pricing term whose rate applies, mirroring
 * the client's own "daily / weekly / monthly / 3-month" ladder (longer
 * commitment -> better per-day rate). This is a documented business
 * assumption, not a database field — see docs/ARCHITECTURE.md.
 */
export function resolveTermForDays(days: number): PricingTerm {
  if (days < 7) return 'daily'
  if (days < 30) return 'weekly'
  if (days < 90) return 'monthly'
  return '3_month'
}

const UNIT_LENGTH: Record<PricingTerm, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  '3_month': 90,
}

export const TERM_LABELS: Record<PricingTerm, string> = {
  daily: 'per day',
  weekly: 'per week',
  monthly: 'per month',
  '3_month': 'per 3 months',
}

export interface RentalQuote {
  term: PricingTerm
  units: number
  unitPrice: number
  totalPrice: number
  currency: string
  /** true if the ideal term for this length wasn't priced and we fell back to another one. */
  isFallback: boolean
}

/**
 * Prices a rental of `days` days. Each priced term is billed pro rata at its
 * own per-day rate (a 10-day rental on a weekly rate pays 10/7 of the
 * weekly price, not two full weeks), with a minimum of one full unit of
 * that term — so a slightly shorter rental can still take a longer, cheaper
 * package (29 days on the monthly rate when that is cheaper than 29 days
 * on the weekly rate). The cheapest option wins, so the price never jumps
 * when a customer adds a day. Returns null only if there are no pricing
 * rows at all. Mirrored byte-for-byte in the create-booking Edge Function
 * (which imports this file), so the checkout total and the charged total
 * always agree.
 */
export function quoteForDays(pricing: PricingRow[], days: number): RentalQuote | null {
  if (pricing.length === 0) return null

  const rentalDays = Math.max(1, days)
  const idealTerm = resolveTermForDays(rentalDays)
  const idealIsPriced = pricing.some((p) => p.term === idealTerm)
  let best: RentalQuote | null = null

  for (const row of pricing) {
    const unitLength = UNIT_LENGTH[row.term as PricingTerm]
    if (!unitLength) continue
    const units = Math.max(1, rentalDays / unitLength)
    const totalPrice = Math.round(row.client_price * units * 100) / 100
    if (!best || totalPrice < best.totalPrice) {
      best = {
        term: row.term as PricingTerm,
        units: Math.round(units * 100) / 100,
        unitPrice: row.client_price,
        totalPrice,
        currency: row.currency,
        isFallback: !idealIsPriced,
      }
    }
  }

  return best
}

/** The cheapest per-day-equivalent priced term, for a simple "From AED X" display with no dates selected yet. */
export function cheapestHeadlineRate(pricing: PricingRow[]): PricingRow | null {
  if (pricing.length === 0) return null
  const daily = pricing.find((p) => p.term === 'daily')
  if (daily) return daily
  return [...pricing].sort((a, b) => a.client_price / UNIT_LENGTH[a.term] - b.client_price / UNIT_LENGTH[b.term])[0]
}
