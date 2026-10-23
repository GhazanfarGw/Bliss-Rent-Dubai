import { describe, it, expect } from 'vitest'
import { quoteForDays, resolveTermForDays, cheapestHeadlineRate } from '@/lib/pricing'
import type { Database } from '@/types/database'

type PricingRow = Database['public']['Tables']['pricing']['Row']

function row(overrides: Partial<PricingRow>): PricingRow {
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

describe('resolveTermForDays', () => {
  it('picks daily under a week', () => {
    expect(resolveTermForDays(3)).toBe('daily')
    expect(resolveTermForDays(6)).toBe('daily')
  })
  it('picks weekly from 7 up to 29 days', () => {
    expect(resolveTermForDays(7)).toBe('weekly')
    expect(resolveTermForDays(29)).toBe('weekly')
  })
  it('picks monthly from 30 up to 89 days', () => {
    expect(resolveTermForDays(30)).toBe('monthly')
    expect(resolveTermForDays(89)).toBe('monthly')
  })
  it('picks 3_month at 90+ days', () => {
    expect(resolveTermForDays(90)).toBe('3_month')
    expect(resolveTermForDays(200)).toBe('3_month')
  })
})

describe('quoteForDays', () => {
  it('returns null when the vehicle has no pricing rows', () => {
    expect(quoteForDays([], 5)).toBeNull()
  })

  it('computes a daily total for a short rental', () => {
    const pricing = [row({ term: 'daily', client_price: 575 })]
    const quote = quoteForDays(pricing, 3)
    expect(quote).toEqual({
      term: 'daily',
      units: 3,
      unitPrice: 575,
      totalPrice: 1725,
      currency: 'AED',
      isFallback: false,
    })
  })

  it('prorates a partial week at the weekly per-day rate instead of charging two weeks', () => {
    const pricing = [row({ term: 'weekly', client_price: 3623 })]
    // 10 days -> 10/7 of a week
    const quote = quoteForDays(pricing, 10)
    expect(quote?.term).toBe('weekly')
    expect(quote?.units).toBe(1.43)
    expect(quote?.totalPrice).toBe(5175.71)
  })

  it('picks the cheapest term so the price never jumps when a day is added (live MG 3 rates)', () => {
    const pricing = [
      row({ term: 'daily', client_price: 72 }),
      row({ term: 'weekly', client_price: 453.6 }),
      row({ term: 'monthly', client_price: 1382.4 }),
      row({ term: '3_month', client_price: 3032.64 }),
    ]
    expect(quoteForDays(pricing, 3)).toMatchObject({ term: 'daily', totalPrice: 216 })
    expect(quoteForDays(pricing, 8)).toMatchObject({ term: 'weekly', totalPrice: 518.4 })
    expect(quoteForDays(pricing, 31)).toMatchObject({ term: 'monthly', totalPrice: 1428.48 })
    expect(quoteForDays(pricing, 90)).toMatchObject({ term: '3_month', totalPrice: 3032.64 })
    // 29 days on the weekly rate (1879.2) is dearer than one month (1382.4)
    expect(quoteForDays(pricing, 29)).toMatchObject({ term: 'monthly', totalPrice: 1382.4 })
    let previous = 0
    for (let d = 1; d <= 120; d++) {
      const total = quoteForDays(pricing, d)!.totalPrice
      expect(total).toBeGreaterThanOrEqual(previous)
      previous = total
    }
  })

  it('falls back to another priced term when the ideal one is missing', () => {
    const pricing = [row({ term: 'daily', client_price: 575 })]
    // 10 days ideally wants 'weekly', which isn't priced -> falls back to daily
    const quote = quoteForDays(pricing, 10)
    expect(quote?.term).toBe('daily')
    expect(quote?.isFallback).toBe(true)
    expect(quote?.units).toBe(10)
  })
})

describe('cheapestHeadlineRate', () => {
  it('prefers the daily rate when present', () => {
    const pricing = [row({ term: 'monthly', client_price: 9600 }), row({ term: 'daily', client_price: 575 })]
    expect(cheapestHeadlineRate(pricing)?.term).toBe('daily')
  })

  it('falls back to the cheapest per-day-equivalent rate otherwise', () => {
    const pricing = [row({ term: 'weekly', client_price: 700 }), row({ term: 'monthly', client_price: 2400 })]
    // weekly: 100/day, monthly: 80/day -> monthly wins
    expect(cheapestHeadlineRate(pricing)?.term).toBe('monthly')
  })

  it('returns null with no pricing at all', () => {
    expect(cheapestHeadlineRate([])).toBeNull()
  })
})
