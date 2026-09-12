/**
 * Phase 7 — OWNER DECISION CONFIRMED (2026-08-29): a late extension
 * (requested after the original return date has already passed —
 * explicitly allowed, no advance-request window is enforced) carries a
 * percentage-of-base-amount penalty, initially 10%. That 10% is a starting
 * VALUE, not a hard-coded rule — this function has always read the rate
 * from `settings` (ultimately extension_penalty_settings, an
 * owner-configurable table — see AdminSettingsPage.tsx's "Late-extension
 * penalty policy" section) rather than a literal in this file, so the
 * owner can change 10% to 15% (or switch policy entirely) from Settings
 * with zero code deployment — see
 * supabase/migrations/20260906000000_phase7_penalty_admin_control_and_audit.sql.
 * The result now also reports `rateUsed` — the raw configured value
 * applied (the percentage/per-day/fixed-fee number itself, not the
 * computed money amount) — so callers can freeze it onto the extension
 * record (booking_extensions.penalty_rate_used) at processing time,
 * keeping an already-processed extension's shown rate stable even after
 * the owner later changes the live setting. Independently configurable
 * from extension pricing — see src/lib/extensionPricing.ts — these are two
 * separate business decisions.
 */
export type ExtensionPenaltyPolicy = 'fixed_fee' | 'per_day' | 'percentage'

export interface ExtensionPenaltySettings {
  /** null = not yet configured. computeExtensionPenalty refuses to guess. */
  policy: ExtensionPenaltyPolicy | null
  fixedFeeAmount: number | null
  perDayAmount: number | null
  percentageRate: number | null
  currency: string
}

export interface ExtensionPenaltyInput {
  settings: ExtensionPenaltySettings
  isLate: boolean
  extensionDays: number
  /** The base extension amount (before any penalty) — only read for the 'percentage' policy. */
  extensionAmount: number
}

export interface ExtensionPenaltyResult {
  policy: ExtensionPenaltyPolicy
  amount: number
  currency: string
  /** The raw configured value actually applied (the percentage rate, per-day amount, or fixed fee — matching `policy`), distinct from `amount` (the computed AED figure). Freeze this onto booking_extensions.penalty_rate_used at processing time so history stays accurate after a later settings change. */
  rateUsed: number
}

export class ExtensionPenaltyError extends Error {}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Computes the late-extension penalty under WHICHEVER policy is currently
 * configured. Returns `null` (never zero, never a guess) when the
 * extension is not late — a penalty amount only ever exists for a late
 * extension. Throws ExtensionPenaltyError when the extension IS late but:
 *  - no penalty policy is configured yet,
 *  - 'fixed_fee' is configured but no fee amount has been set,
 *  - 'per_day' is configured but no per-day amount has been set,
 *  - 'percentage' is configured but no percentage rate has been set.
 */
export function computeExtensionPenalty(input: ExtensionPenaltyInput): ExtensionPenaltyResult | null {
  const { settings, isLate, extensionDays, extensionAmount } = input

  if (!isLate) return null

  if (!settings.policy) {
    throw new ExtensionPenaltyError(
      'This extension is late (the original return date has already passed) and the late-extension penalty has not been configured yet. Ask the owner to set it in Settings before processing late extensions.',
    )
  }

  if (settings.policy === 'fixed_fee') {
    if (settings.fixedFeeAmount == null) {
      throw new ExtensionPenaltyError('A fixed late-extension penalty fee has not been configured yet.')
    }
    return { policy: 'fixed_fee', amount: round2(settings.fixedFeeAmount), currency: settings.currency, rateUsed: settings.fixedFeeAmount }
  }

  if (settings.policy === 'per_day') {
    if (settings.perDayAmount == null) {
      throw new ExtensionPenaltyError('A per-day late-extension penalty amount has not been configured yet.')
    }
    return {
      policy: 'per_day',
      amount: round2(settings.perDayAmount * extensionDays),
      currency: settings.currency,
      rateUsed: settings.perDayAmount,
    }
  }

  // percentage
  if (settings.percentageRate == null) {
    throw new ExtensionPenaltyError('A late-extension penalty percentage has not been configured yet.')
  }
  return {
    policy: 'percentage',
    amount: round2((settings.percentageRate / 100) * extensionAmount),
    currency: settings.currency,
    rateUsed: settings.percentageRate,
  }
}
