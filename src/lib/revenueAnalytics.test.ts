import { describe, expect, it } from 'vitest'
import {
  buildCategoryBreakdown,
  buildDailyCandles,
  buildDailyRevenueSeries,
  buildTopVehicles,
  computeRevenueTotals,
  type RevenuePayment,
} from '@/lib/revenueAnalytics'

// Fixed "now" so every test is deterministic regardless of when it runs.
const NOW = new Date('2026-08-26T12:00:00.000Z')

function payment(overrides: Partial<RevenuePayment>): RevenuePayment {
  return {
    amount: 100,
    paidAt: '2026-08-26T09:00:00.000Z',
    categoryName: 'Economy',
    vehicleLabel: 'Toyota Corolla',
    ...overrides,
  }
}

describe('computeRevenueTotals', () => {
  it('returns all zeros for an empty list', () => {
    const totals = computeRevenueTotals([], NOW)
    expect(totals).toEqual({
      allTime: 0,
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      lastMonthFull: 0,
      monthOverMonthPct: null,
      avgBookingValue: 0,
      paidBookingsCount: 0,
    })
  })

  it('buckets today / this week / this month correctly', () => {
    const payments = [
      payment({ amount: 100, paidAt: '2026-08-26T09:00:00.000Z' }), // today
      payment({ amount: 50, paidAt: '2026-08-22T09:00:00.000Z' }), // 4 days ago, within week + month
      payment({ amount: 30, paidAt: '2026-08-01T09:00:00.000Z' }), // earlier this month, outside the 7-day window
      payment({ amount: 20, paidAt: '2026-07-15T09:00:00.000Z' }), // last month
    ]
    const totals = computeRevenueTotals(payments, NOW)
    expect(totals.allTime).toBe(200)
    expect(totals.today).toBe(100)
    expect(totals.thisWeek).toBe(150) // today + Aug 22
    expect(totals.thisMonth).toBe(180) // today + Aug 22 + Aug 1
    expect(totals.lastMonthFull).toBe(20)
    expect(totals.paidBookingsCount).toBe(4)
    expect(totals.avgBookingValue).toBe(50)
  })

  it('computes month-over-month using a comparable same-length window', () => {
    // "now" is Aug 26 → 26 days elapsed this month. Comparable window in
    // July is July 1–26.
    const payments = [
      payment({ amount: 200, paidAt: '2026-08-10T09:00:00.000Z' }), // this month
      payment({ amount: 100, paidAt: '2026-07-10T09:00:00.000Z' }), // within July 1-26 window
      payment({ amount: 999, paidAt: '2026-07-30T09:00:00.000Z' }), // outside the comparable window (excluded from %, included in lastMonthFull)
    ]
    const totals = computeRevenueTotals(payments, NOW)
    expect(totals.thisMonth).toBe(200)
    expect(totals.lastMonthFull).toBe(1099)
    // (200 - 100) / 100 * 100 = 100%
    expect(totals.monthOverMonthPct).toBe(100)
  })

  it('returns null month-over-month when the comparable prior window has no revenue', () => {
    const payments = [payment({ amount: 200, paidAt: '2026-08-10T09:00:00.000Z' })]
    const totals = computeRevenueTotals(payments, NOW)
    expect(totals.monthOverMonthPct).toBeNull()
  })
})

describe('buildDailyRevenueSeries', () => {
  it('produces one point per day, including zero-revenue days, oldest first', () => {
    const payments = [payment({ amount: 100, paidAt: '2026-08-26T09:00:00.000Z' }), payment({ amount: 40, paidAt: '2026-08-24T09:00:00.000Z' })]
    const series = buildDailyRevenueSeries(payments, 3, NOW)
    expect(series.map((p) => p.date)).toEqual(['2026-08-24', '2026-08-25', '2026-08-26'])
    expect(series[0]).toEqual({ date: '2026-08-24', revenue: 40, bookings: 1 })
    expect(series[1]).toEqual({ date: '2026-08-25', revenue: 0, bookings: 0 })
    expect(series[2]).toEqual({ date: '2026-08-26', revenue: 100, bookings: 1 })
  })
})

describe('buildDailyCandles', () => {
  it('builds open/high/low/close from same-day payments ordered by time, and nulls empty days', () => {
    const payments = [
      payment({ amount: 150, paidAt: '2026-08-26T08:00:00.000Z' }), // earliest → open
      payment({ amount: 90, paidAt: '2026-08-26T10:00:00.000Z' }), // lowest
      payment({ amount: 200, paidAt: '2026-08-26T14:00:00.000Z' }), // latest → close, also highest
    ]
    const candles = buildDailyCandles(payments, 2, NOW)
    expect(candles[0]).toEqual({ date: '2026-08-25', candle: null })
    expect(candles[1].date).toBe('2026-08-26')
    expect(candles[1].candle).toEqual({ open: 150, close: 200, high: 200, low: 90, volume: 3 })
  })
})

describe('buildCategoryBreakdown', () => {
  it('aggregates revenue per category, sorted descending, with correct percentages', () => {
    const payments = [
      payment({ amount: 300, categoryName: 'Luxury' }),
      payment({ amount: 100, categoryName: 'Economy' }),
      payment({ amount: 100, categoryName: 'Economy' }),
      payment({ amount: 100, categoryName: null }),
    ]
    const breakdown = buildCategoryBreakdown(payments)
    expect(breakdown).toEqual([
      { name: 'Luxury', revenue: 300, bookings: 1, percent: 50 },
      { name: 'Economy', revenue: 200, bookings: 2, percent: (200 / 600) * 100 },
      { name: null, revenue: 100, bookings: 1, percent: (100 / 600) * 100 },
    ])
  })

  it('returns an empty array with no zero-division blowup', () => {
    expect(buildCategoryBreakdown([])).toEqual([])
  })
})

describe('buildTopVehicles', () => {
  it('sorts by revenue descending and respects the limit', () => {
    const payments = [
      payment({ amount: 50, vehicleLabel: 'A' }),
      payment({ amount: 500, vehicleLabel: 'B' }),
      payment({ amount: 200, vehicleLabel: 'C' }),
      payment({ amount: 50, vehicleLabel: 'A' }),
    ]
    const top = buildTopVehicles(payments, 2)
    expect(top).toEqual([
      { label: 'B', revenue: 500, bookings: 1 },
      { label: 'C', revenue: 200, bookings: 1 },
    ])
  })
})
