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

  it('computes a weekly total rounding up partial weeks', () => {
    const pricing = [row({ term: 'weekly', client_price: 3623 })]
    // 10 days -> ceil(10/7) = 2 weeks
    const quote = quoteForDays(pricing, 10)
    expect(quote?.term).toBe('weekly')
    expect(quote?.units).toBe(2)
    expect(quote?.totalPrice).toBe(7246)
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
