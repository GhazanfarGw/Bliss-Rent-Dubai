import { useRef, useState } from 'react'
import type { CandleDay } from '@/lib/revenueAnalytics'
import { evenTickIndices, formatCurrencyCompact, formatCurrencyFull, formatTooltipDate } from '@/features/admin/dashboard/charts/chartUtils'

interface RevenueCandlestickChartProps {
  data: CandleDay[]
  currency: string
  labels: {
    open: string
    high: string
    low: string
    close: string
    formatBookings: (count: number) => string
    noData: string
  }
}

const W = 720
const H = 240
const PAD_LEFT = 56
const PAD_RIGHT = 12
const PAD_TOP = 16
const PAD_BOTTOM = 28
const GRID_LINES = 4
const MIN_BODY_HEIGHT = 2

/**
 * Hand-built daily candlestick chart. Each candle is built from that
 * day's individual paid-booking amounts (open = earliest, close =
 * latest, wick = day's high/low) — see buildDailyCandles' doc comment
 * for why this is the honest analogue rather than a real OHLC price
 * series. Days with no paid bookings render as a gap, not a flat bar.
 */
export function RevenueCandlestickChart({ data, currency, labels }: RevenueCandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const plotW = W - PAD_LEFT - PAD_RIGHT
  const plotH = H - PAD_TOP - PAD_BOTTOM
  const slotW = data.length > 0 ? plotW / data.length : plotW
  const bodyW = Math.min(22, slotW * 0.55)

  const highs = data.flatMap((d) => (d.candle ? [d.candle.high] : []))
  const lows = data.flatMap((d) => (d.candle ? [d.candle.low] : []))
  const hasAnyData = highs.length > 0
  const domainMax = hasAnyData ? Math.max(...highs) * 1.1 : 1
  const domainMin = hasAnyData ? Math.min(0, Math.min(...lows) * 0.9) : 0

  const xFor = (i: number) => PAD_LEFT + slotW * i + slotW / 2
  const yFor = (value: number) => PAD_TOP + plotH - ((value - domainMin) / (domainMax - domainMin || 1)) * plotH

  const gridValues = Array.from({ length: GRID_LINES + 1 }, (_, i) => domainMin + ((domainMax - domainMin) / GRID_LINES) * i)
  const tickIndices = evenTickIndices(data.length, 7)

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const relativeX = ((e.clientX - rect.left) / rect.width) * W
    const index = Math.floor((relativeX - PAD_LEFT) / slotW)
    setHoverIndex(Math.min(data.length - 1, Math.max(0, index)))
  }

  const hovered = hoverIndex != null ? data[hoverIndex] : null
  const tooltipLeftPct = hoverIndex != null ? Math.min(85, Math.max(2, (xFor(hoverIndex) / W) * 100)) : 0

  return (
    <div ref={containerRef} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }} role="img" aria-label="Daily booking value range">
        {gridValues.map((v) => (
          <g key={v}>
            <line x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={yFor(v)} y2={yFor(v)} stroke="#e0dcec" strokeWidth={1} />
            <text x={PAD_LEFT - 8} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94a3b8">
              {formatCurrencyCompact(v, currency)}
            </text>
          </g>
        ))}

        {tickIndices.map((i) => (
          <text key={i} x={xFor(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#94a3b8">
            {new Date(`${data[i].date}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
          </text>
        ))}

        {data.map((d, i) => {
          if (!d.candle) return null
          const { open, close, high, low } = d.candle
          const bullish = close >= open
          const color = bullish ? '#10b981' : '#f43f5e'
          const bodyTop = yFor(Math.max(open, close))
          const bodyHeight = Math.max(MIN_BODY_HEIGHT, Math.abs(yFor(open) - yFor(close)))
          return (
            <g key={d.date}>
              <line x1={xFor(i)} x2={xFor(i)} y1={yFor(high)} y2={yFor(low)} stroke={color} strokeWidth={1.5} />
              <rect x={xFor(i) - bodyW / 2} y={bodyTop} width={bodyW} height={bodyHeight} fill={color} rx={1.5} />
            </g>
          )
        })}

        {hoverIndex != null && (
          <line
            x1={xFor(hoverIndex)}
            x2={xFor(hoverIndex)}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke="#b49b6c"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

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
          {hovered.candle ? (
            <div className="mt-1 space-y-0.5 text-text-muted">
              <p>
                {labels.open}: <span className="font-medium text-brand-navy">{formatCurrencyFull(hovered.candle.open, currency)}</span>
              </p>
              <p>
                {labels.high}: <span className="font-medium text-brand-navy">{formatCurrencyFull(hovered.candle.high, currency)}</span>
              </p>
              <p>
                {labels.low}: <span className="font-medium text-brand-navy">{formatCurrencyFull(hovered.candle.low, currency)}</span>
              </p>
              <p>
                {labels.close}: <span className="font-medium text-brand-navy">{formatCurrencyFull(hovered.candle.close, currency)}</span>
              </p>
              <p>{labels.formatBookings(hovered.candle.volume)}</p>
            </div>
          ) : (
            <p className="mt-0.5 text-text-muted">{labels.noData}</p>
          )}
        </div>
      )}
    </div>
  )
}
