import { rentalDays } from '@/lib/dateRange'
import type { Database } from '@/types/database'

type PricingRow = Database['public']['Tables']['pricing']['Row']

/**
 * Phase 7 — OWNER DECISION CONFIRMED (2026-08-29): extensions bill at the
 * vehicle's CURRENT daily rate, never the original booking's historical
 * rate, and with no additional markup on a normal (non-late) extension.
 * extension_pricing_settings.policy is now seeded 'current_rate' (see
 * supabase/migrations/20260905000000_phase7_pricing_decisions_confirmed.sql)
 * instead of the NULL "not yet decided" state Phase 7 originally shipped
 * with. 'original_rate' and 'custom_rate' remain implemented (the settings
 * architecture stays configurable — same "owner-level business decision,
 * not a hard-coded assumption" philosophy as before) in case the owner
 * ever revisits this, but the ACTIVE, confirmed rule going forward is
 * current_rate with no markup. See
 * supabase/migrations/20260902000000_phase7_rental_extensions.sql for the
 * original architecture note.
 */
export type ExtensionPricingPolicy = 'original_rate' | 'current_rate' | 'custom_rate'

export interface ExtensionPricingSettings {
  /** null = not yet configured. computeExtensionAmount refuses to guess. */
  policy: ExtensionPricingPolicy | null
  customDailyRate: number | null
  customCurrency: string
}

export interface OriginalBookingPricingContext {
  startDate: string
  endDate: string
  totalPrice: number
  currency: string
}

export interface ExtensionPricingInput {
  settings: ExtensionPricingSettings
  extensionDays: number
  originalBooking: OriginalBookingPricingContext
  /** The vehicle's current pricing rows — only read for the 'current_rate' policy. */
  currentVehiclePricing: PricingRow[]
}

export interface ExtensionPricingResult {
  policy: ExtensionPricingPolicy
  amount: number
  currency: string
}

export class ExtensionPricingError extends Error {}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Computes the amount for an extension under WHICHEVER policy is
 * currently configured. This is the single authoritative pricing
 * calculation for extensions — same "one TypeScript path, SQL is only a
 * data-integrity backstop" convention Phase 2's create_booking already
 * established for the original booking price (see
 * request_booking_extension's own comment).
 *
 * Throws ExtensionPricingError (never returns a guessed amount) when:
 *  - no policy is configured yet,
 *  - 'current_rate' is configured but the vehicle has no pricing rows,
 *  - 'custom_rate' is configured but no custom daily rate has been set,
 *  - the extension length itself is out of the 1-30 day bound.
 */
export function computeExtensionAmount(input: ExtensionPricingInput): ExtensionPricingResult {
  const { settings, extensionDays, originalBooking, currentVehiclePricing } = input

  if (!Number.isInteger(extensionDays) || extensionDays < 1 || extensionDays > 30) {
    throw new ExtensionPricingError('Extension length must be between 1 and 30 days.')
  }

  if (!settings.policy) {
    throw new ExtensionPricingError(
      'Extension pricing policy has not been configured yet. Ask the owner to set it in Settings before processing extensions.',
    )
  }

  if (settings.policy === 'original_rate') {
    const originalTotalDays = rentalDays(originalBooking.startDate, originalBooking.endDate)
    const dailyRate = originalBooking.totalPrice / originalTotalDays
    return { policy: 'original_rate', amount: round2(dailyRate * extensionDays), currency: originalBooking.currency }
  }

  if (settings.policy === 'current_rate') {
    // Deliberately NOT quoteForDays()'s tiered daily/weekly/monthly logic —
    // the owner's confirmed formula is specifically
    // "current_vehicle_daily_rate × extension_days" (e.g. AED 100/day × 5
    // days = AED 500), regardless of how long the extension is. Using the
    // tiered engine here would silently apply a cheaper weekly/monthly
    // rate to a 7+ day extension, which is a different (and unconfirmed)
    // business rule than the one actually approved.
    const dailyRow = currentVehiclePricing.find((p) => p.term === 'daily')
    if (!dailyRow) {
      throw new ExtensionPricingError(
        'This vehicle has no current daily rate configured — cannot calculate the extension amount. Add a daily price for this vehicle in Fleet pricing first.',
      )
    }
    return { policy: 'current_rate', amount: round2(dailyRow.client_price * extensionDays), currency: dailyRow.currency }
  }

  // custom_rate
  if (settings.customDailyRate == null) {
    throw new ExtensionPricingError('A custom extension daily rate has not been configured yet.')
  }
  return {
    policy: 'custom_rate',
    amount: round2(settings.customDailyRate * extensionDays),
    currency: settings.customCurrency,
  }
}

/** Plain day-count between two ISO dates (exclusive delta — matches how "requested return date" moves forward from the current return date, e.g. Sep 2 -> Sep 5 = 3 days). Never negative; callers validate the 1-30 bound themselves via computeExtensionAmount / validateExtensionRequest. */
export function extensionDaysBetween(previousReturnDate: string, requestedReturnDate: string): number {
  const prev = new Date(previousReturnDate + 'T00:00:00')
  const next = new Date(requestedReturnDate + 'T00:00:00')
  return Math.round((next.getTime() - prev.getTime()) / 86_400_000)
}
