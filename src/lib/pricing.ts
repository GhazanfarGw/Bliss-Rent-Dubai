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
 * Picks the best-matching priced term for the requested rental length and
 * computes a total. Falls back to any other term that IS priced (rather
 * than showing nothing) if the ideal one is missing pricing data — real
 * fleets won't always have every tier filled in for every vehicle.
 * Returns null only if the vehicle has no pricing rows at all.
 */
export function quoteForDays(pricing: PricingRow[], days: number): RentalQuote | null {
  if (pricing.length === 0) return null

  const idealTerm = resolveTermForDays(days)
  const preferredOrder: PricingTerm[] = [
    idealTerm,
    'daily',
    'weekly',
    'monthly',
    '3_month',
  ]

  for (const term of preferredOrder) {
    const row = pricing.find((p) => p.term === term)
    if (!row) continue
    const units = Math.max(1, Math.ceil(days / UNIT_LENGTH[term]))
    return {
      term,
      units,
      unitPrice: row.client_price,
      totalPrice: Math.round(row.client_price * units * 100) / 100,
      currency: row.currency,
      isFallback: term !== idealTerm,
    }
  }

  return null
}

/** The cheapest per-day-equivalent priced term, for a simple "From AED X" display with no dates selected yet. */
export function cheapestHeadlineRate(pricing: PricingRow[]): PricingRow | null {
  if (pricing.length === 0) return null
  const daily = pricing.find((p) => p.term === 'daily')
  if (daily) return daily
  return [...pricing].sort((a, b) => a.client_price / UNIT_LENGTH[a.term] - b.client_price / UNIT_LENGTH[b.term])[0]
}
