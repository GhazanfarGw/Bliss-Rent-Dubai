/** Pure calendar-layout math — which dates fall in which grid cell for a given month. No booking/availability logic here at all. */
export interface CalendarCell {
  date: string // ISO yyyy-mm-dd
  inMonth: boolean
}

export function buildMonthGrid(year: number, month0: number): CalendarCell[] {
  const firstOfMonth = new Date(year, month0, 1)
  const startWeekday = firstOfMonth.getDay() // 0 = Sunday
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()

  const cells: CalendarCell[] = []

  // Leading days from the previous month, to fill the first week.
  for (let i = 0; i < startWeekday; i++) {
    const d = new Date(year, month0, 1 - (startWeekday - i))
    cells.push({ date: toIso(d), inMonth: false })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: toIso(new Date(year, month0, day)), inMonth: true })
  }

  // Trailing days to complete the last week.
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]
    const [y, m, d] = last.date.split('-').map(Number)
    const next = new Date(y, m - 1, d + 1)
    cells.push({ date: toIso(next), inMonth: false })
  }

  return cells
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
