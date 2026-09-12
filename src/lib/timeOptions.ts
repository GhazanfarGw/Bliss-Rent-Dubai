/**
 * Pure, framework-free time-of-day options for the pickup/return time
 * selects in SearchWidget. Deliberately separate from `dateRange.ts` and
 * `calendarGrid.ts`: this is display-only metadata about *when in the day*
 * the customer plans to arrive, not a date-range/business rule of any
 * kind. Nothing here participates in availability, the no-overlap
 * exclusion constraint, or pricing — see the Phase [time-selection] report
 * for why that stays true for this pass.
 */

/** Every half-hour from 00:00 to 23:30, as 24h "HH:mm" strings. */
export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2)
  const minutes = i % 2 === 0 ? '00' : '30'
  return `${String(hours).padStart(2, '0')}:${minutes}`
})

export const DEFAULT_TIME = '10:00'

/** Formats a "HH:mm" value for display in the given language (e.g. "10:00 AM"). */
export function formatTimeLabel(value: string, language: string): string {
  const [h, m] = value.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, m)
  return new Intl.DateTimeFormat(language, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    calendar: 'gregory',
    numberingSystem: 'latn',
  }).format(d)
}
