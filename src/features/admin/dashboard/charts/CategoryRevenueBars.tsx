import type { CategoryRevenueSlice } from '@/lib/revenueAnalytics'
import { formatCurrencyFull } from '@/features/admin/dashboard/charts/chartUtils'

const BAR_COLORS = ['#2e2a54', '#b49b6c', '#46407c', '#d9c9a3', '#96794a', '#8b86b8']

interface CategoryRevenueBarsProps {
  slices: CategoryRevenueSlice[]
  currency: string
  uncategorizedLabel: string
  emptyLabel: string
}

/** Simple horizontal bar breakdown — deliberately plain divs/percent widths rather than SVG, since this is a ranked list, not a coordinate chart. */
export function CategoryRevenueBars({ slices, currency, uncategorizedLabel, emptyLabel }: CategoryRevenueBarsProps) {
  if (slices.length === 0) {
    return <p className="py-6 text-center text-sm text-text-muted">{emptyLabel}</p>
  }

  return (
    <div className="space-y-3">
      {slices.map((slice, i) => (
        <div key={slice.name ?? '__uncategorized'}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-brand-navy">{slice.name ?? uncategorizedLabel}</span>
            <span className="shrink-0 text-text-muted">
              {formatCurrencyFull(slice.revenue, currency)} · {slice.percent.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-brand-lavender">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max(2, slice.percent)}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
