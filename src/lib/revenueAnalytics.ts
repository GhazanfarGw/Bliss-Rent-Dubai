/**
 * Pure, side-effect-free revenue aggregation. Every chart/KPI on the admin
 * Dashboard's Revenue section is derived from a flat list of paid payments
 * by these functions — no Supabase calls here (see adminRevenueApi.ts for
 * fetching), so the math can be unit-tested against fixed dates without a
 * database.
 *
 * Every "now" parameter is a required, explicit Date rather than an
 * internal `new Date()` call, specifically so tests can pin the reference
 * date and get deterministic output.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface RevenuePayment {
  amount: number
  /** ISO timestamp — always present; only ever built from payments that have paid_at set. */
  paidAt: string
  categoryName: string | null
  vehicleLabel: string | null
}

export interface RevenueTotals {
  allTime: number
  today: number
  thisWeek: number
  thisMonth: number
  /** Full previous calendar month, for context next to thisMonth. */
  lastMonthFull: number
  /**
   * % change of this-month-so-far vs. the SAME number of days at the start
   * of last month (an apples-to-apples comparison, not this-month-partial
   * vs. last-month-whole). Null when there's nothing in the comparison
   * period to divide by.
   */
  monthOverMonthPct: number | null
  avgBookingValue: number
  paidBookingsCount: number
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function paymentDate(p: RevenuePayment): string {
  return p.paidAt.slice(0, 10)
}

function sum(payments: RevenuePayment[]): number {
  return payments.reduce((acc, p) => acc + p.amount, 0)
}

export function computeRevenueTotals(payments: RevenuePayment[], now: Date): RevenueTotals {
  const todayStr = isoDate(now)
  const weekStartStr = isoDate(new Date(now.getTime() - 6 * MS_PER_DAY))

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthStartStr = isoDate(monthStart)
  const daysElapsedThisMonth = Math.floor((now.getTime() - monthStart.getTime()) / MS_PER_DAY) + 1

  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const lastMonthStartStr = isoDate(lastMonthStart)
  const lastMonthEnd = new Date(monthStart.getTime() - MS_PER_DAY) // last day of previous month
  const lastMonthEndStr = isoDate(lastMonthEnd)
  const lastMonthComparableEndStr = isoDate(
    new Date(Math.min(lastMonthStart.getTime() + (daysElapsedThisMonth - 1) * MS_PER_DAY, lastMonthEnd.getTime())),
  )

  const allTime = sum(payments)
  const today = sum(payments.filter((p) => paymentDate(p) === todayStr))
  const thisWeek = sum(payments.filter((p) => paymentDate(p) >= weekStartStr))
  const thisMonth = sum(payments.filter((p) => paymentDate(p) >= monthStartStr))
  const lastMonthFull = sum(payments.filter((p) => paymentDate(p) >= lastMonthStartStr && paymentDate(p) <= lastMonthEndStr))
  const lastMonthComparable = sum(
    payments.filter((p) => paymentDate(p) >= lastMonthStartStr && paymentDate(p) <= lastMonthComparableEndStr),
  )

  const monthOverMonthPct = lastMonthComparable > 0 ? ((thisMonth - lastMonthComparable) / lastMonthComparable) * 100 : null

  const paidBookingsCount = payments.length
  const avgBookingValue = paidBookingsCount > 0 ? allTime / paidBookingsCount : 0

  return { allTime, today, thisWeek, thisMonth, lastMonthFull, monthOverMonthPct, avgBookingValue, paidBookingsCount }
}

export interface DailyRevenuePoint {
  date: string
  revenue: number
  bookings: number
}

/** Last `days` calendar days ending today (inclusive), one point per day — zero-revenue days included so the chart never silently skips a gap. */
export function buildDailyRevenueSeries(payments: RevenuePayment[], days: number, now: Date): DailyRevenuePoint[] {
  const points: DailyRevenuePoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = isoDate(new Date(now.getTime() - i * MS_PER_DAY))
    const dayPayments = payments.filter((p) => paymentDate(p) === dateStr)
    points.push({ date: dateStr, revenue: sum(dayPayments), bookings: dayPayments.length })
  }
  return points
}

export interface Candle {
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface CandleDay {
  date: string
  candle: Candle | null
}

/**
 * One "candle" per day built from that day's individual paid-booking
 * amounts (open = earliest payment, close = latest, high/low = the
 * range across all of that day's bookings). There's no traditional
 * open/high/low/close price series behind a rental business, so this is
 * the honest analogue: it shows how much booking values varied within a
 * day, not a security's intraday price. A day with no paid bookings has a
 * null candle (rendered as a gap, not a flat zero line).
 */
export function buildDailyCandles(payments: RevenuePayment[], days: number, now: Date): CandleDay[] {
  const result: CandleDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = isoDate(new Date(now.getTime() - i * MS_PER_DAY))
    const dayPayments = payments.filter((p) => paymentDate(p) === dateStr).sort((a, b) => a.paidAt.localeCompare(b.paidAt))
    if (dayPayments.length === 0) {
      result.push({ date: dateStr, candle: null })
      continue
    }
    const amounts = dayPayments.map((p) => p.amount)
    result.push({
      date: dateStr,
      candle: {
        open: amounts[0],
        close: amounts[amounts.length - 1],
        high: Math.max(...amounts),
        low: Math.min(...amounts),
        volume: amounts.length,
      },
    })
  }
  return result
}

export interface CategoryRevenueSlice {
  name: string | null
  revenue: number
  bookings: number
  percent: number
}

/** Sorted descending by revenue. `name: null` means the booking's vehicle had no category assigned. */
export function buildCategoryBreakdown(payments: RevenuePayment[]): CategoryRevenueSlice[] {
  const totals = new Map<string | null, { revenue: number; bookings: number }>()
  const grandTotal = sum(payments)
  for (const p of payments) {
    const entry = totals.get(p.categoryName) ?? { revenue: 0, bookings: 0 }
    entry.revenue += p.amount
    entry.bookings += 1
    totals.set(p.categoryName, entry)
  }
  return Array.from(totals.entries())
    .map(([name, v]) => ({ name, revenue: v.revenue, bookings: v.bookings, percent: grandTotal > 0 ? (v.revenue / grandTotal) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
}

export interface VehicleRevenueRow {
  label: string | null
  revenue: number
  bookings: number
}

/** Top vehicles by revenue, sorted descending, capped to `limit`. `label: null` means the payment's booking/vehicle couldn't be resolved. */
export function buildTopVehicles(payments: RevenuePayment[], limit: number): VehicleRevenueRow[] {
  const totals = new Map<string | null, { revenue: number; bookings: number }>()
  for (const p of payments) {
    const entry = totals.get(p.vehicleLabel) ?? { revenue: 0, bookings: 0 }
    entry.revenue += p.amount
    entry.bookings += 1
    totals.set(p.vehicleLabel, entry)
  }
  return Array.from(totals.entries())
    .map(([label, v]) => ({ label, revenue: v.revenue, bookings: v.bookings }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}
