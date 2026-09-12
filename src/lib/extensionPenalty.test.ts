import { describe, it, expect } from 'vitest'
import { computeExtensionPenalty, ExtensionPenaltyError, type ExtensionPenaltySettings } from './extensionPenalty'

const UNSET: ExtensionPenaltySettings = {
  policy: null,
  fixedFeeAmount: null,
  perDayAmount: null,
  percentageRate: null,
  currency: 'AED',
}

describe('computeExtensionPenalty', () => {
  it('returns null (never a guessed amount) when the extension is not late, regardless of policy', () => {
    const settings: ExtensionPenaltySettings = { ...UNSET, policy: 'fixed_fee', fixedFeeAmount: 200 }
    const result = computeExtensionPenalty({ settings, isLate: false, extensionDays: 3, extensionAmount: 300 })
    expect(result).toBeNull()
  })

  it('refuses to guess when late and no policy is configured yet', () => {
    expect(() => computeExtensionPenalty({ settings: UNSET, isLate: true, extensionDays: 2, extensionAmount: 200 })).toThrow(
      ExtensionPenaltyError,
    )
  })

  it('computes a flat fixed fee regardless of extension length, and reports the raw fee as rateUsed', () => {
    const settings: ExtensionPenaltySettings = { ...UNSET, policy: 'fixed_fee', fixedFeeAmount: 150 }
    const result = computeExtensionPenalty({ settings, isLate: true, extensionDays: 10, extensionAmount: 900 })
    expect(result).toEqual({ policy: 'fixed_fee', amount: 150, currency: 'AED', rateUsed: 150 })
  })

  it('throws for fixed_fee configured without an amount', () => {
    const settings: ExtensionPenaltySettings = { ...UNSET, policy: 'fixed_fee' }
    expect(() => computeExtensionPenalty({ settings, isLate: true, extensionDays: 1, extensionAmount: 100 })).toThrow(
      ExtensionPenaltyError,
    )
  })

  it('computes per-day penalty scaled by extension length, and reports the raw per-day amount as rateUsed', () => {
    const settings: ExtensionPenaltySettings = { ...UNSET, policy: 'per_day', perDayAmount: 25 }
    const result = computeExtensionPenalty({ settings, isLate: true, extensionDays: 4, extensionAmount: 400 })
    expect(result).toEqual({ policy: 'per_day', amount: 100, currency: 'AED', rateUsed: 25 })
  })

  it('throws for per_day configured without an amount', () => {
    const settings: ExtensionPenaltySettings = { ...UNSET, policy: 'per_day' }
    expect(() => computeExtensionPenalty({ settings, isLate: true, extensionDays: 1, extensionAmount: 100 })).toThrow(
      ExtensionPenaltyError,
    )
  })

  it('computes percentage penalty against the base extension amount, and reports the raw percentage as rateUsed', () => {
    const settings: ExtensionPenaltySettings = { ...UNSET, policy: 'percentage', percentageRate: 10 }
    const result = computeExtensionPenalty({ settings, isLate: true, extensionDays: 3, extensionAmount: 500 })
    expect(result).toEqual({ policy: 'percentage', amount: 50, currency: 'AED', rateUsed: 10 })
  })

  it('matches the owner-confirmed late-extension example exactly: AED 500 base × 10% = AED 50 penalty (total AED 550)', () => {
    // Owner-confirmed formula (2026-08-29): extension_base_amount = current
    // daily rate × days (AED 100 × 5 = AED 500); late_penalty = base × 10%
    // (AED 50); total = AED 550. Only applies to a LATE extension — see the
    // "returns null when not late" test above for the normal-extension case.
    const settings: ExtensionPenaltySettings = { ...UNSET, policy: 'percentage', percentageRate: 10 }
    const result = computeExtensionPenalty({ settings, isLate: true, extensionDays: 5, extensionAmount: 500 })
    expect(result).toEqual({ policy: 'percentage', amount: 50, currency: 'AED', rateUsed: 10 })
    expect(500 + (result?.amount ?? 0)).toBe(550)
  })

  it('the 10% initial value is NOT hard-coded — reading a different configured percentage (e.g. after the owner changes Settings 10% -> 15%) changes the result with no code change', () => {
    // Same booking (AED 100/day × 5 days = AED 500 base), only the
    // configured settings object differs — this is exactly what happens
    // when updateExtensionPenaltySettings() persists a new percentage_rate
    // and a later extension is processed under it.
    const initial: ExtensionPenaltySettings = { ...UNSET, policy: 'percentage', percentageRate: 10 }
    const changed: ExtensionPenaltySettings = { ...UNSET, policy: 'percentage', percentageRate: 15 }

    const before = computeExtensionPenalty({ settings: initial, isLate: true, extensionDays: 5, extensionAmount: 500 })
    const after = computeExtensionPenalty({ settings: changed, isLate: true, extensionDays: 5, extensionAmount: 500 })

    expect(before).toEqual({ policy: 'percentage', amount: 50, currency: 'AED', rateUsed: 10 })
    expect(after).toEqual({ policy: 'percentage', amount: 75, currency: 'AED', rateUsed: 15 })
    expect(500 + (after?.amount ?? 0)).toBe(575)
  })

  it('throws for percentage configured without a rate', () => {
    const settings: ExtensionPenaltySettings = { ...UNSET, policy: 'percentage' }
    expect(() => computeExtensionPenalty({ settings, isLate: true, extensionDays: 1, extensionAmount: 100 })).toThrow(
      ExtensionPenaltyError,
    )
  })

  it('rounds to 2 decimal places', () => {
    const settings: ExtensionPenaltySettings = { ...UNSET, policy: 'percentage', percentageRate: 7.5 }
    const result = computeExtensionPenalty({ settings, isLate: true, extensionDays: 1, extensionAmount: 333.33 })
    expect(result?.amount).toBe(25.0)
  })
})
