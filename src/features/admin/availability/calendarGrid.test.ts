import { describe, it, expect } from 'vitest'
import { buildMonthGrid } from './calendarGrid'

describe('buildMonthGrid', () => {
  it('returns a whole number of weeks', () => {
    const grid = buildMonthGrid(2026, 1) // February 2026
    expect(grid.length % 7).toBe(0)
  })

  it('includes every day of the month, marked inMonth', () => {
    const grid = buildMonthGrid(2026, 1) // February 2026 has 28 days
    const inMonthDates = grid.filter((c) => c.inMonth).map((c) => c.date)
    expect(inMonthDates).toHaveLength(28)
    expect(inMonthDates[0]).toBe('2026-02-01')
    expect(inMonthDates[inMonthDates.length - 1]).toBe('2026-02-28')
  })

  it('pads leading/trailing days from adjacent months as inMonth: false', () => {
    const grid = buildMonthGrid(2026, 1)
    expect(grid[0].inMonth || grid[0].date.startsWith('2026-02')).toBe(true)
    const leading = grid.filter((c) => !c.inMonth)
    for (const cell of leading) {
      expect(cell.date.startsWith('2026-02')).toBe(false)
    }
  })
})
