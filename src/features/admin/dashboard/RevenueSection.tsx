import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchRevenuePayments } from '@/features/admin/dashboard/adminRevenueApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { RevenueTrendChart } from '@/features/admin/dashboard/charts/RevenueTrendChart'
import { RevenueCandlestickChart } from '@/features/admin/dashboard/charts/RevenueCandlestickChart'
import { CategoryRevenueBars } from '@/features/admin/dashboard/charts/CategoryRevenueBars'
import { formatCurrencyFull } from '@/features/admin/dashboard/charts/chartUtils'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import {
  buildCategoryBreakdown,
  buildDailyCandles,
  buildDailyRevenueSeries,
  buildTopVehicles,
  computeRevenueTotals,
  type RevenuePayment,
} from '@/lib/revenueAnalytics'

const CURRENCY = 'AED'
const RANGE_OPTIONS = [7, 14, 30] as const
type RangeDays = (typeof RANGE_OPTIONS)[number]

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; payments: RevenuePayment[] }

export function RevenueSection() {
  const { t } = useTranslation()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [range, setRange] = useState<RangeDays>(30)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetchRevenuePayments()
      .then((payments) => {
        if (!cancelled) setState({ status: 'loaded', payments })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric') })
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const now = useMemo(() => new Date(), [])

  const totals = useMemo(
    () => (state.status === 'loaded' ? computeRevenueTotals(state.payments, now) : null),
    [state, now],
  )
  const dailySeries = useMemo(
    () => (state.status === 'loaded' ? buildDailyRevenueSeries(state.payments, range, now) : []),
    [state, range, now],
  )
  const candles = useMemo(
    () => (state.status === 'loaded' ? buildDailyCandles(state.payments, range, now) : []),
    [state, range, now],
  )
  const categorySlices = useMemo(
    () => (state.status === 'loaded' ? buildCategoryBreakdown(state.payments) : []),
    [state],
  )
  const topVehicles = useMemo(() => (state.status === 'loaded' ? buildTopVehicles(state.payments, 5) : []), [state])

  return (
    <section className="rounded-2xl border border-brand-navy/10 bg-white p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-navy">{t('admin.dashboard.revenue.title')}</h2>
          <p className="text-xs text-text-muted">{t('admin.dashboard.revenue.subtitle')}</p>
        </div>
        {state.status === 'loaded' && (
          <div className="flex gap-1 rounded-lg bg-brand-lavender/60 p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setRange(opt)}
                className={
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ' +
                  (range === opt ? 'bg-white text-brand-navy shadow-sm' : 'text-text-muted hover:text-brand-navy')
                }
              >
                {opt}D
              </button>
            ))}
          </div>
        )}
      </div>

      {state.status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
        </div>
      )}

      {state.status === 'error' && <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />}

      {state.status === 'loaded' && totals && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <RevenueKpiCard label={t('admin.dashboard.revenue.allTime')} value={formatCurrencyFull(totals.allTime, CURRENCY)} />
            <RevenueKpiCard
              label={t('admin.dashboard.revenue.thisMonth')}
              value={formatCurrencyFull(totals.thisMonth, CURRENCY)}
              trendPct={totals.monthOverMonthPct}
              trendCaption={t('admin.dashboard.revenue.vsLastMonth')}
              subCaption={
                totals.monthOverMonthPct == null
                  ? t('admin.dashboard.revenue.lastMonthValue', { value: formatCurrencyFull(totals.lastMonthFull, CURRENCY) })
                  : undefined
              }
            />
            <RevenueKpiCard label={t('admin.dashboard.revenue.thisWeek')} value={formatCurrencyFull(totals.thisWeek, CURRENCY)} />
            <RevenueKpiCard
              label={t('admin.dashboard.revenue.avgBooking')}
              value={formatCurrencyFull(totals.avgBookingValue, CURRENCY)}
              subCaption={t('admin.dashboard.revenue.paidBookingsCount', { count: totals.paidBookingsCount })}
            />
          </div>

          {totals.paidBookingsCount === 0 ? (
            <div className="mt-6">
              <StateMessage title={t('admin.dashboard.revenue.noDataTitle')} body={t('admin.dashboard.revenue.noDataBody')} />
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
              <ChartCard title={t('admin.dashboard.revenue.trendTitle')} subtitle={t('admin.dashboard.revenue.trendSubtitle')}>
                <RevenueTrendChart
                  data={dailySeries}
                  currency={CURRENCY}
                  formatBookings={(count) => t('admin.dashboard.revenue.bookingsCount', { count })}
                />
              </ChartCard>

              <ChartCard title={t('admin.dashboard.revenue.candlestickTitle')} subtitle={t('admin.dashboard.revenue.candlestickSubtitle')}>
                <RevenueCandlestickChart
                  data={candles}
                  currency={CURRENCY}
                  labels={{
                    open: t('admin.dashboard.revenue.candle.open'),
                    high: t('admin.dashboard.revenue.candle.high'),
                    low: t('admin.dashboard.revenue.candle.low'),
                    close: t('admin.dashboard.revenue.candle.close'),
                    formatBookings: (count) => t('admin.dashboard.revenue.bookingsCount', { count }),
                    noData: t('admin.dashboard.revenue.candle.noData'),
                  }}
                />
              </ChartCard>

              <ChartCard title={t('admin.dashboard.revenue.categoryTitle')} subtitle={t('admin.dashboard.revenue.categorySubtitle')}>
                <CategoryRevenueBars
                  slices={categorySlices}
                  currency={CURRENCY}
                  uncategorizedLabel={t('admin.dashboard.revenue.uncategorized')}
                  emptyLabel={t('admin.dashboard.revenue.categoryEmpty')}
                />
              </ChartCard>

              <ChartCard title={t('admin.dashboard.revenue.topVehiclesTitle')} subtitle={t('admin.dashboard.revenue.topVehiclesSubtitle')}>
                {topVehicles.length === 0 ? (
                  <p className="py-6 text-center text-sm text-text-muted">{t('admin.dashboard.revenue.topVehiclesEmpty')}</p>
                ) : (
                  <ol className="space-y-3">
                    {topVehicles.map((v, i) => (
                      <li key={v.label ?? '__unknown'} className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-lavender text-xs font-bold text-brand-navy">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-brand-navy">{v.label ?? t('admin.dashboard.revenue.unknownVehicle')}</p>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-brand-lavender">
                            <div
                              className="h-full rounded-full bg-brand-gold"
                              style={{ width: `${topVehicles[0].revenue > 0 ? (v.revenue / topVehicles[0].revenue) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-brand-navy">{formatCurrencyFull(v.revenue, CURRENCY)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </ChartCard>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function RevenueKpiCard({
  label,
  value,
  trendPct,
  trendCaption,
  subCaption,
}: {
  label: string
  value: string
  trendPct?: number | null
  trendCaption?: string
  subCaption?: string
}) {
  return (
    <div className="rounded-xl border border-brand-navy/10 bg-white p-4">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-navy">{value}</p>
      {typeof trendPct === 'number' && (
        <p className={'mt-1 inline-flex items-center gap-1 text-xs font-semibold ' + (trendPct >= 0 ? 'text-success' : 'text-error')}>
          <span aria-hidden="true">{trendPct >= 0 ? '▲' : '▼'}</span>
          {Math.abs(trendPct).toFixed(0)}%<span className="font-normal text-text-muted">{trendCaption}</span>
        </p>
      )}
      {subCaption && <p className="mt-1 text-xs text-text-muted">{subCaption}</p>}
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-brand-navy/10 bg-white p-4">
      <h3 className="text-sm font-semibold text-brand-navy">{title}</h3>
      <p className="mb-3 text-xs text-text-muted">{subtitle}</p>
      {children}
    </div>
  )
}
