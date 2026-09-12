import { describe, it, expect } from 'vitest'
import { computeExtensionAmount, extensionDaysBetween, ExtensionPricingError } from '@/lib/extensionPricing'
import type { ExtensionPricingSettings, OriginalBookingPricingContext } from '@/lib/extensionPricing'
import type { Database } from '@/types/database'

type PricingRow = Database['public']['Tables']['pricing']['Row']

function pricingRow(overrides: Partial<PricingRow>): PricingRow {
  return {
    id: 'p1',
    vehicle_id: 'v1',
    term: 'daily',
    list_price: 100,
    client_price: 100,
    currency: 'AED',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const ORIGINAL: OriginalBookingPricingContext = {
  startDate: '2026-08-29',
  endDate: '2026-09-02', // rentalDays = 5 (inclusive)
  totalPrice: 500,
  currency: 'AED',
}

function settings(overrides: Partial<ExtensionPricingSettings>): ExtensionPricingSettings {
  return { policy: null, customDailyRate: null, customCurrency: 'AED', ...overrides }
}

describe('extensionDaysBetween', () => {
  it('matches the spec example: Sep 2 -> Sep 5 is 3 days', () => {
    expect(extensionDaysBetween('2026-09-02', '2026-09-05')).toBe(3)
  })
  it('a single extra day', () => {
    expect(extensionDaysBetween('2026-09-02', '2026-09-03')).toBe(1)
  })
})

describe('computeExtensionAmount — no policy configured', () => {
  it('refuses to guess and throws a clear error', () => {
    expect(() =>
      computeExtensionAmount({
        settings: settings({ policy: null }),
        extensionDays: 3,
        originalBooking: ORIGINAL,
        currentVehiclePricing: [],
      }),
    ).toThrow(ExtensionPricingError)
  })
})

describe('computeExtensionAmount — duration bounds', () => {
  it('rejects 0 days', () => {
    expect(() =>
      computeExtensionAmount({
        settings: settings({ policy: 'original_rate' }),
        extensionDays: 0,
        originalBooking: ORIGINAL,
        currentVehiclePricing: [],
      }),
    ).toThrow(/1 and 30/)
  })
  it('rejects 31 days', () => {
    expect(() =>
      computeExtensionAmount({
        settings: settings({ policy: 'original_rate' }),
        extensionDays: 31,
        originalBooking: ORIGINAL,
        currentVehiclePricing: [],
      }),
    ).toThrow(/1 and 30/)
  })
  it('accepts the minimum, 1 day', () => {
    const result = computeExtensionAmount({
      settings: settings({ policy: 'original_rate' }),
      extensionDays: 1,
      originalBooking: ORIGINAL,
      currentVehiclePricing: [],
    })
    expect(result.amount).toBeCloseTo(100) // 500 / 5 days = 100/day
  })
  it('accepts the maximum, 30 days', () => {
    const result = computeExtensionAmount({
      settings: settings({ policy: 'original_rate' }),
      extensionDays: 30,
      originalBooking: ORIGINAL,
      currentVehiclePricing: [],
    })
    expect(result.amount).toBeCloseTo(3000) // 100/day * 30
  })
})

describe('computeExtensionAmount — original_rate policy', () => {
  it('derives the effective daily rate from the original booking total_price / rentalDays', () => {
    const result = computeExtensionAmount({
      settings: settings({ policy: 'original_rate' }),
      extensionDays: 3,
      originalBooking: ORIGINAL, // 500 AED / 5 days = 100/day
      currentVehiclePricing: [],
    })
    expect(result).toEqual({ policy: 'original_rate', amount: 300, currency: 'AED' })
  })
})

describe('computeExtensionAmount — current_rate policy (owner-confirmed formula: current_vehicle_daily_rate × extension_days)', () => {
  it('matches the owner-confirmed example exactly: AED 100/day × 5 days = AED 500', () => {
    const result = computeExtensionAmount({
      settings: settings({ policy: 'current_rate' }),
      extensionDays: 5,
      originalBooking: ORIGINAL,
      currentVehiclePricing: [pricingRow({ term: 'daily', client_price: 100 })],
    })
    expect(result).toEqual({ policy: 'current_rate', amount: 500, currency: 'AED' })
  })

  it('uses the vehicle CURRENT daily rate, not the original booking rate', () => {
    const result = computeExtensionAmount({
      settings: settings({ policy: 'current_rate' }),
      extensionDays: 3,
      originalBooking: ORIGINAL, // original rate was 100/day (500/5) — current rate below is different
      currentVehiclePricing: [pricingRow({ term: 'daily', client_price: 150 })],
    })
    expect(result).toEqual({ policy: 'current_rate', amount: 450, currency: 'AED' })
  })

  it('regression: always multiplies the plain DAILY rate by extension days, never a cheaper weekly/monthly tiered rate, even for a 7+ day extension', () => {
    // Before the fix, this policy delegated to quoteForDays(), which for a
    // 10-day extension would pick the WEEKLY term/rate (tiered engine used
    // for original bookings) instead of daily-rate × days — silently
    // undercharging relative to the owner's confirmed formula.
    const result = computeExtensionAmount({
      settings: settings({ policy: 'current_rate' }),
      extensionDays: 10,
      originalBooking: ORIGINAL,
      currentVehiclePricing: [
        pricingRow({ term: 'daily', client_price: 100 }),
        pricingRow({ id: 'p2', term: 'weekly', client_price: 500 }), // would be picked by the tiered engine for 10 days
      ],
    })
    expect(result).toEqual({ policy: 'current_rate', amount: 1000, currency: 'AED' }) // 100/day * 10, NOT the weekly rate
  })

  it('throws when the vehicle has no current DAILY pricing row, even if other terms (weekly/monthly) are priced', () => {
    expect(() =>
      computeExtensionAmount({
        settings: settings({ policy: 'current_rate' }),
        extensionDays: 3,
        originalBooking: ORIGINAL,
        currentVehiclePricing: [pricingRow({ term: 'weekly', client_price: 500 })],
      }),
    ).toThrow(ExtensionPricingError)
  })

  it('throws when the vehicle has no current pricing rows at all', () => {
    expect(() =>
      computeExtensionAmount({
        settings: settings({ policy: 'current_rate' }),
        extensionDays: 3,
        originalBooking: ORIGINAL,
        currentVehiclePricing: [],
      }),
    ).toThrow(ExtensionPricingError)
  })
})

describe('computeExtensionAmount — custom_rate policy', () => {
  it('uses the configured custom daily rate and currency', () => {
    const result = computeExtensionAmount({
      settings: settings({ policy: 'custom_rate', customDailyRate: 80, customCurrency: 'USD' }),
      extensionDays: 4,
      originalBooking: ORIGINAL,
      currentVehiclePricing: [],
    })
    expect(result).toEqual({ policy: 'custom_rate', amount: 320, currency: 'USD' })
  })
  it('throws when no custom rate has been set', () => {
    expect(() =>
      computeExtensionAmount({
        settings: settings({ policy: 'custom_rate', customDailyRate: null }),
        extensionDays: 4,
        originalBooking: ORIGINAL,
        currentVehiclePricing: [],
      }),
    ).toThrow(ExtensionPricingError)
  })
})
