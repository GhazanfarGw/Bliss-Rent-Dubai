/**
 * Pure date-range validation for the search widget. No React, no
 * Supabase — kept framework-free so it's trivially unit-testable and
 * reusable between the home page search widget and the listing page's
 * "edit search" controls.
 */

export type DateRangeError =
  | 'start_required'
  | 'end_required'
  | 'start_in_past'
  | 'end_before_start'

export interface DateRangeValidationResult {
  valid: boolean
  error: DateRangeError | null
}

/** `today` is injectable so callers (and tests) don't depend on the real clock. */
export function validateDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  today: Date = new Date(),
): DateRangeValidationResult {
  if (!startDate) return { valid: false, error: 'start_required' }
  if (!endDate) return { valid: false, error: 'end_required' }

  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (start < todayMidnight) return { valid: false, error: 'start_in_past' }
  if (end < start) return { valid: false, error: 'end_before_start' }

  return { valid: true, error: null }
}

export const DATE_RANGE_ERROR_MESSAGES: Record<DateRangeError, string> = {
  start_required: 'Please choose a pickup date.',
  end_required: 'Please choose a drop-off date.',
  start_in_past: 'Pickup date can\'t be in the past.',
  end_before_start: 'Drop-off date must be on or after the pickup date.',
}

/** Inclusive day count between two ISO date strings (same-day rental = 1 day). */
export function rentalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const ms = end.getTime() - start.getTime()
  return Math.max(1, Math.round(ms / 86_400_000) + 1)
}

/**
 * Whole days remaining between today and a booking's return date — the
 * "Days Left" figure on the homepage Booking Status panel (Phase 11
 * correction). Never negative: a return date already in the past (a
 * completed or overdue rental) reads as 0 rather than a confusing negative
 * count. `today` is injectable so callers (and tests) don't depend on the
 * real clock, matching `validateDateRange` above.
 */
export function daysRemaining(endDate: string, today: Date = new Date()): number {
  const end = new Date(endDate + 'T00:00:00')
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const ms = end.getTime() - todayMidnight.getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}
