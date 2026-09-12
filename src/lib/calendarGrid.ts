/**
 * Pure, framework-free calendar-grid math for the rental date-range
 * picker (`DateRangePicker.tsx`). Deliberately separate from
 * `dateRange.ts` — that file owns the actual business rules
 * (`validateDateRange`, `rentalDays`) and is left untouched by this
 * UX work; this file only turns a (year, month) into the day cells a
 * calendar UI needs to render, plus a few small ISO-string helpers.
 * No date library dependency — every rental date in this app is
 * already a plain `YYYY-MM-DD` string, so plain `Date` math (always
 * anchored to local midnight, never UTC) is enough.
 */

export interface CalendarDay {
  /** `YYYY-MM-DD` */
  iso: string
  day: number
}

export interface MonthGrid {
  year: number
  month0: number
  /** Monday-first weeks; `null` cells pad the first/last week. */
  weeks: (CalendarDay | null)[][]
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function isoDate(year: number, month0: number, day: number): string {
  const d = new Date(year, month0, day)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function parseIso(iso: string): { year: number; month0: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month0: m - 1, day: d }
}

/** `delta` months from `(year, month0)` — handles year rollover either direction. */
export function addMonths(year: number, month0: number, delta: number): { year: number; month0: number } {
  const total = year * 12 + month0 + delta
  return { year: Math.floor(total / 12), month0: ((total % 12) + 12) % 12 }
}

export function addDaysIso(iso: string, delta: number): string {
  const { year, month0, day } = parseIso(iso)
  return isoDate(year, month0, day + delta)
}

/** Lexicographic compare works directly on `YYYY-MM-DD` strings — no parsing needed. */
export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Monday-first day grid for one calendar month. Always a whole number of
 * 7-day weeks, padded with `null` before the 1st and after the last day
 * — never leaks in the adjoining month's real dates, so two panels
 * (current + next month) can be shown side by side unambiguously.
 */
export function buildMonthGrid(year: number, month0: number): MonthGrid {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const firstWeekdaySun0 = new Date(year, month0, 1).getDay() // 0=Sun..6=Sat
  const leading = (firstWeekdaySun0 + 6) % 7 // Mon=0..Sun=6

  const cells: (CalendarDay | null)[] = Array(leading).fill(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: isoDate(year, month0, day), day })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (CalendarDay | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return { year, month0, weeks }
}

/** e.g. "August 2026" (or the Arabic equivalent) — always Gregorian, Latin digits, matching the rest of the app's date handling (see `.ltr-nums` in index.css). */
export function formatMonthLabel(year: number, month0: number, language: string): string {
  return new Intl.DateTimeFormat(language, {
    month: 'long',
    year: 'numeric',
    calendar: 'gregory',
    numberingSystem: 'latn',
  }).format(new Date(year, month0, 1))
}

/** e.g. "30 Aug" — used in the compact Pickup/Return summary. */
export function formatShortDate(iso: string, language: string): string {
  const { year, month0, day } = parseIso(iso)
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    calendar: 'gregory',
    numberingSystem: 'latn',
  }).format(new Date(year, month0, day))
}

/** e.g. "30 Aug 2026" — used in the outer search-widget summary. */
export function formatLongDate(iso: string, language: string): string {
  const { year, month0, day } = parseIso(iso)
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    calendar: 'gregory',
    numberingSystem: 'latn',
  }).format(new Date(year, month0, day))
}

/** Full accessible date, e.g. "Monday, August 31, 2026" — the aria-label for one calendar day button. */
export function formatFullDate(iso: string, language: string): string {
  const { year, month0, day } = parseIso(iso)
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    calendar: 'gregory',
    numberingSystem: 'latn',
  }).format(new Date(year, month0, day))
}
