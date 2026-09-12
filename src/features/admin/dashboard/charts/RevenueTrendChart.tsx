import { useRef, useState } from 'react'
import type { DailyRevenuePoint } from '@/lib/revenueAnalytics'
import { evenTickIndices, formatCurrencyCompact, formatCurrencyFull, formatTooltipDate } from '@/features/admin/dashboard/charts/chartUtils'

interface RevenueTrendChartProps {
  data: DailyRevenuePoint[]
  currency: string
  formatBookings: (count: number) => string
}

const W = 720
const H = 240
const PAD_LEFT = 56
const PAD_RIGHT = 12
const PAD_TOP = 16
const PAD_BOTTOM = 28
const GRID_LINES = 4

/**
 * Hand-built (no charting library) area + line chart of daily revenue.
 * Uses a fixed internal SVG coordinate system (viewBox) stretched to the
 * container's width via `width="100%"`, so it stays responsive without a
 * resize observer.
 */
export function RevenueTrendChart({ data, currency, formatBookings }: RevenueTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const plotW = W - PAD_LEFT - PAD_RIGHT
  const plotH = H - PAD_TOP - PAD_BOTTOM
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1)
  const domainMax = maxRevenue * 1.15

  const xFor = (i: number) => PAD_LEFT + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2)
  const yFor = (revenue: number) => PAD_TOP + plotH - (revenue / domainMax) * plotH

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(d.revenue)}`).join(' ')
  const areaPath = `${linePath} L ${xFor(data.length - 1)} ${PAD_TOP + plotH} L ${xFor(0)} ${PAD_TOP + plotH} Z`

  const tickIndices = evenTickIndices(data.length, 7)
  const gridValues = Array.from({ length: GRID_LINES + 1 }, (_, i) => (domainMax / GRID_LINES) * i)

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const relativeX = ((e.clientX - rect.left) / rect.width) * W
    const fraction = (relativeX - PAD_LEFT) / plotW
    const index = Math.round(fraction * (data.length - 1))
    setHoverIndex(Math.min(data.length - 1, Math.max(0, index)))
  }

  const hovered = hoverIndex != null ? data[hoverIndex] : null
  // Clamp the tooltip's horizontal position so it never overflows the chart edges.
  const tooltipLeftPct = hoverIndex != null ? Math.min(88, Math.max(2, (xFor(hoverIndex) / W) * 100)) : 0

  return (
    <div ref={containerRef} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }} role="img" aria-label="Daily revenue trend">
        <defs>
          <linearGradient id="revenueAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2e2a54" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2e2a54" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Gridlines + y-axis labels */}
        {gridValues.map((v) => (
          <g key={v}>
            <line x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={yFor(v)} y2={yFor(v)} stroke="#e0dcec" strokeWidth={1} />
            <text x={PAD_LEFT - 8} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94a3b8">
              {formatCurrencyCompact(v, currency)}
            </text>
          </g>
        ))}

        {/* x-axis labels */}
        {tickIndices.map((i) => (
          <text key={i} x={xFor(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#94a3b8">
            {new Date(`${data[i].date}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
          </text>
        ))}

        <path d={areaPath} fill="url(#revenueAreaFill)" stroke="none" />
        <path d={linePath} fill="none" stroke="#2e2a54" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hoverIndex != null && (
          <>
            <line
              x1={xFor(hoverIndex)}
              x2={xFor(hoverIndex)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotH}
              stroke="#b49b6c"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={xFor(hoverIndex)} cy={yFor(data[hoverIndex].revenue)} r={4} fill="#b49b6c" stroke="white" strokeWidth={1.5} />
          </>
        )}

        {/* Invisible full-height hit area for hover tracking */}
        <rect
          x={PAD_LEFT}
          y={0}
          width={plotW}
          height={H}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        />
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-1 rounded-lg border border-brand-navy/10 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${tooltipLeftPct}%` }}
        >
          <p className="font-semibold text-brand-navy">{formatTooltipDate(hovered.date)}</p>
          <p className="mt-0.5 font-bold text-brand-navy">{formatCurrencyFull(hovered.revenue, currency)}</p>
          <p className="text-text-muted">{formatBookings(hovered.bookings)}</p>
        </div>
      )}
    </div>
  )
}
