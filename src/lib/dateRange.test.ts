import { describe, it, expect } from 'vitest'
import { validateDateRange, rentalDays, daysRemaining } from '@/lib/dateRange'

const FIXED_TODAY = new Date('2026-09-10T12:00:00')

describe('validateDateRange', () => {
  it('rejects a missing start date', () => {
    expect(validateDateRange(null, '2026-09-15', FIXED_TODAY)).toEqual({
      valid: false,
      error: 'start_required',
    })
  })

  it('rejects a missing end date', () => {
    expect(validateDateRange('2026-09-12', null, FIXED_TODAY)).toEqual({
      valid: false,
      error: 'end_required',
    })
  })

  it('rejects a start date in the past', () => {
    expect(validateDateRange('2026-09-01', '2026-09-15', FIXED_TODAY)).toEqual({
      valid: false,
      error: 'start_in_past',
    })
  })

  it('rejects an end date before the start date', () => {
    expect(validateDateRange('2026-09-15', '2026-09-12', FIXED_TODAY)).toEqual({
      valid: false,
      error: 'end_before_start',
    })
  })

  it('accepts today as a valid start date', () => {
    expect(validateDateRange('2026-09-10', '2026-09-12', FIXED_TODAY)).toEqual({
      valid: true,
      error: null,
    })
  })

  it('accepts the same day for start and end (1-day rental)', () => {
    expect(validateDateRange('2026-09-12', '2026-09-12', FIXED_TODAY)).toEqual({
      valid: true,
      error: null,
    })
  })
})

describe('rentalDays', () => {
  it('counts a same-day rental as 1 day', () => {
    expect(rentalDays('2026-09-12', '2026-09-12')).toBe(1)
  })

  it('counts inclusively across multiple days', () => {
    expect(rentalDays('2026-09-12', '2026-09-15')).toBe(4)
  })

  it('handles a month-long rental', () => {
    expect(rentalDays('2026-09-01', '2026-09-30')).toBe(30)
  })
})

describe('daysRemaining', () => {
  it('counts whole days between today and a future return date', () => {
    expect(daysRemaining('2026-09-15', FIXED_TODAY)).toBe(5)
  })

  it('returns 0 when the return date is today', () => {
    expect(daysRemaining('2026-09-10', FIXED_TODAY)).toBe(0)
  })

  it('clamps to 0 rather than going negative for a past return date', () => {
    expect(daysRemaining('2026-09-01', FIXED_TODAY)).toBe(0)
  })
})
