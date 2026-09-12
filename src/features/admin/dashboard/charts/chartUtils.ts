/** Shared formatting/scaling helpers for the hand-built SVG charts in this folder. */

/** "AED 12,345" — matches the `{currency} {amount.toLocaleString()}` convention used everywhere else in the app. */
export function formatCurrencyFull(amount: number, currency: string): string {
  return `${currency} ${Math.round(amount).toLocaleString()}`
}

/** Compact form for axis ticks/labels where space is tight: 1,200 -> "1.2K", 45,000 -> "45K". Small values are shown in full. */
export function formatCurrencyCompact(amount: number, currency: string): string {
  const abs = Math.abs(amount)
  if (abs < 1000) return `${currency} ${Math.round(amount)}`
  if (abs < 1_000_000) {
    const thousands = amount / 1000
    return `${currency} ${(Number.isInteger(thousands) ? thousands : thousands.toFixed(1))}K`
  }
  const millions = amount / 1_000_000
  return `${currency} ${(Number.isInteger(millions) ? millions : millions.toFixed(1))}M`
}

/** Short weekday+day label for x-axis ticks, e.g. "Mon 24". Parses a plain 'YYYY-MM-DD' date string as UTC to avoid local-timezone day drift. */
export function formatShortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** Longer label for tooltips, e.g. "Wed, Aug 26". */
export function formatTooltipDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** Picks up to `maxTicks` evenly-spaced indices from an array of length n, always including the first and last. */
export function evenTickIndices(n: number, maxTicks: number): number[] {
  if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i)
  const step = (n - 1) / (maxTicks - 1)
  const indices = new Set<number>()
  for (let i = 0; i < maxTicks; i++) indices.add(Math.round(i * step))
  return Array.from(indices).sort((a, b) => a - b)
}
