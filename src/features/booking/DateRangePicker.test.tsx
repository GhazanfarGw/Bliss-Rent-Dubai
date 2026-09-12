import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateRangePicker } from '@/features/booking/DateRangePicker'
import i18n from '@/i18n'

/**
 * Covers the new rental date-range calendar end to end. Business rules
 * themselves (minimum date, past-date/order validation, same-day-rental
 * rule, rental-day count) are exercised directly and in isolation in
 * `src/lib/dateRange.test.ts`, untouched by this feature — these tests
 * only check that the calendar UI drives that same, unmodified logic
 * correctly and presents it clearly.
 */

function futureIso(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fullDateLabel(iso: string, language = 'en'): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    calendar: 'gregory',
    numberingSystem: 'latn',
  }).format(new Date(y, m - 1, d))
}

/** Matches the shorter "2 Sep 2026" format shown in the Pickup/Return summary. */
function summaryDateLabel(iso: string, language = 'en'): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    calendar: 'gregory',
    numberingSystem: 'latn',
  }).format(new Date(y, m - 1, d))
}

const TODAY_ISO = futureIso(0)

/** The calendar's own trigger button — found by its stable ARIA contract
 *  rather than by its (state-dependent) visible text, since the same
 *  button's label legitimately changes from "Select dates" to real
 *  dates as the customer picks. */
function getTrigger(): HTMLElement {
  return document.querySelector('button[aria-haspopup="dialog"]') as HTMLElement
}

async function clickDay(user: ReturnType<typeof userEvent.setup>, iso: string, language = 'en') {
  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: fullDateLabel(iso, language) }))
}

function Harness({ row = false }: { row?: boolean }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  return (
    <DateRangePicker
      row={row}
      startDate={startDate}
      endDate={endDate}
      todayIso={TODAY_ISO}
      onChange={(next) => {
        setStartDate(next.startDate)
        setEndDate(next.endDate)
      }}
    />
  )
}

describe('DateRangePicker', () => {
  it('opens the calendar from a single trigger', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(getTrigger())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('selecting a pickup date shows it as Pickup and automatically switches to return-selecting mode', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(getTrigger())
    const dialog = screen.getByRole('dialog')
    const pickupIso = futureIso(2)

    await clickDay(user, pickupIso)

    expect(within(dialog).getByText(summaryDateLabel(pickupIso))).toBeInTheDocument()
    expect(within(dialog).getByText('Select return date')).toBeInTheDocument()
  })

  it('selecting a return date completes the range and shows the rental-day count', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(getTrigger())
    const dialog = screen.getByRole('dialog')
    const pickupIso = futureIso(1)
    const returnIso = futureIso(4)

    await clickDay(user, pickupIso)
    await clickDay(user, returnIso)

    expect(within(dialog).getByText('4 days')).toBeInTheDocument()
    expect(within(dialog).queryByText('Select return date')).not.toBeInTheDocument()
  })

  it('visually marks the pickup date, the return date, and every day between as selected', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(getTrigger())
    const dialog = screen.getByRole('dialog')
    const pickupIso = futureIso(1)
    const midIso = futureIso(2)
    const returnIso = futureIso(4)

    await clickDay(user, pickupIso)
    await clickDay(user, returnIso)

    const pickupBtn = within(dialog).getByRole('button', { name: fullDateLabel(pickupIso) })
    const returnBtn = within(dialog).getByRole('button', { name: fullDateLabel(returnIso) })
    const midBtn = within(dialog).getByRole('button', { name: fullDateLabel(midIso) })

    expect(pickupBtn).toHaveAttribute('aria-pressed', 'true')
    expect(returnBtn).toHaveAttribute('aria-pressed', 'true')
    expect(midBtn.parentElement).toHaveClass('bg-brand-lavender/60')
  })

  it('prevents choosing a return date earlier than the pickup date', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(getTrigger())
    const dialog = screen.getByRole('dialog')
    const pickupIso = futureIso(5)
    const earlierIso = futureIso(2)

    await clickDay(user, pickupIso)
    const earlierBtn = within(dialog).getByRole('button', { name: fullDateLabel(earlierIso) })

    expect(earlierBtn).toBeDisabled()
    await user.click(earlierBtn)
    // still awaiting a return date — the disabled click was a no-op
    expect(within(dialog).getByText('Select return date')).toBeInTheDocument()
  })

  it('allows a same-day rental when the return date equals the pickup date', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(getTrigger())
    const pickupIso = futureIso(3)

    await clickDay(user, pickupIso)
    await clickDay(user, pickupIso)

    expect(within(screen.getByRole('dialog')).getByText('1 day')).toBeInTheDocument()
  })

  it('still allows today as a valid pickup date', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(getTrigger())
    const todayBtn = within(screen.getByRole('dialog')).getByRole('button', { name: fullDateLabel(TODAY_ISO) })
    expect(todayBtn).not.toBeDisabled()
  })

  it('keeps Done disabled until the range is complete, then closes the calendar', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(getTrigger())
    const dialog = screen.getByRole('dialog')
    const doneButton = within(dialog).getByRole('button', { name: 'Done' })

    expect(doneButton).toBeDisabled()
    await clickDay(user, futureIso(1))
    expect(doneButton).toBeDisabled()
    await clickDay(user, futureIso(3))
    expect(doneButton).toBeEnabled()

    await user.click(doneButton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on Escape without requiring Done', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(getTrigger())
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders a condensed single-line trigger for the row layout, distinct from the default two-column trigger', () => {
    render(<Harness row />)
    expect(screen.queryByText('Select dates')).not.toBeInTheDocument()
    expect(getTrigger()).toHaveTextContent('Pickup')
    expect(getTrigger()).toHaveTextContent('Return')
  })

  it('translates the calendar weekday header into Arabic, in the same Monday-first order, for RTL', async () => {
    const arabicOrder = i18n.getFixedT('ar')('searchWidget.calendar.weekdays', { returnObjects: true }) as string[]
    expect(arabicOrder).toEqual(['اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت', 'أحد'])

    await i18n.changeLanguage('ar')
    try {
      const user = userEvent.setup()
      render(<Harness />)
      await user.click(getTrigger())
      const dialog = screen.getByRole('dialog')
      for (const label of arabicOrder) {
        expect(within(dialog).getAllByText(label).length).toBeGreaterThan(0)
      }
    } finally {
      await i18n.changeLanguage('en')
    }
  })
})
