import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { validateDateRange, rentalDays } from '@/lib/dateRange'
import { isRtl } from '@/i18n'
import { Dialog } from '@/features/shared/ui/Dialog'
import { Button } from '@/features/shared/ui/Button'
import {
  addMonths,
  buildMonthGrid,
  compareIso,
  formatLongDate,
  formatFullDate,
  formatMonthLabel,
  formatShortDate,
  parseIso,
  type CalendarDay,
} from '@/lib/calendarGrid'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onChange: (next: { startDate: string; endDate: string }) => void
  /** Today, as `YYYY-MM-DD` — injected by the caller (same value the rest
   *  of the search widget already computes) so this component never
   *  derives "today" a second, possibly-different way. */
  todayIso: string
  /** Compact single-line trigger for the horizontally-scrollable
   *  `layout="row"` search bar, instead of the two-column stacked
   *  Pickup/Return trigger used everywhere else. Same calendar either way. */
  row?: boolean
  /**
   * Controlled open state. When provided (together with `onOpenChange`), the
   * parent drives when the calendar sheet is open — used by the row-layout
   * guided search flow so the calendar opens automatically once pickup and
   * return locations are chosen. Omit both to keep the default,
   * independently-managed behavior (unchanged, still used elsewhere).
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Close the sheet automatically as soon as a full range is picked,
   * instead of waiting for the "Done" button — used by the guided row-layout
   * flow, where there is no further field to advance to and an extra tap
   * would just be to dismiss the calendar. Other callers keep the explicit
   * "Done" confirmation (default false).
   */
  closeOnComplete?: boolean
}

type Phase = 'start' | 'end' | 'complete'

/**
 * One combined pickup+return date control: a single trigger that opens a
 * calendar sheet where choosing the pickup date automatically activates
 * return-date selection, the whole rental period is highlighted as one
 * continuous range while picking, and a single "Done" button closes it —
 * replacing the two separate native `<input type="date">` fields that
 * previously required opening two independent pickers.
 *
 * All actual date business logic (minimum date, past-date/range
 * validation, same-day-rental rule, rental-day count) is delegated to
 * `@/lib/dateRange` — this component only decides what's clickable and
 * how to draw the range; it introduces no new date rules of its own.
 */
export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  todayIso,
  row = false,
  open: controlledOpen,
  onOpenChange,
  closeOnComplete = false,
}: DateRangePickerProps) {
  const { t, i18n } = useTranslation()
  const rtl = isRtl(i18n.language)
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  function setOpen(next: boolean) {
    if (isControlled) onOpenChange?.(next)
    else setInternalOpen(next)
  }
  const [hoverIso, setHoverIso] = useState<string | null>(null)
  const today = parseIso(todayIso)
  const [viewYear, setViewYear] = useState(today.year)
  const [viewMonth0, setViewMonth0] = useState(today.month0)
  const dayRefs = useRef(new Map<string, HTMLButtonElement>())

  const phase: Phase = !startDate ? 'start' : !endDate ? 'end' : 'complete'
  const validation = validateDateRange(startDate, endDate, new Date(todayIso + 'T00:00:00'))
  const days = startDate && endDate ? rentalDays(startDate, endDate) : null

  useEffect(() => {
    if (!open) return
    setHoverIso(null)
    // Jump the visible month(s) to wherever's most useful to see right
    // now: the pickup month once it's chosen, otherwise today's month.
    const anchor = parseIso(startDate || todayIso)
    setViewYear(anchor.year)
    setViewMonth0(anchor.month0)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only meant to run when the sheet opens, not on every keystroke of startDate/todayIso
  }, [open])

  function handleDayClick(iso: string) {
    if (phase === 'end') {
      if (compareIso(iso, startDate) < 0) return // return can't be before pickup
      onChange({ startDate, endDate: iso })
      if (closeOnComplete) setOpen(false)
      return
    }
    // Fresh pickup, or restarting a completed range from a new date.
    onChange({ startDate: iso, endDate: '' })
  }

  function goToMonth(delta: number) {
    const next = addMonths(viewYear, viewMonth0, delta)
    setViewYear(next.year)
    setViewMonth0(next.month0)
  }

  const atFloorMonth = viewYear === today.year && viewMonth0 === today.month0
  const rightMonth = addMonths(viewYear, viewMonth0, 1)
  const weekdays = t('searchWidget.calendar.weekdays', { returnObjects: true }) as string[]

  const previewEnd =
    phase === 'end' && hoverIso && compareIso(hoverIso, startDate) >= 0 ? hoverIso : null
  const highlightEnd = endDate || previewEnd

  function isHighlighted(iso: string): boolean {
    if (iso === startDate || iso === endDate) return true
    if (previewEnd && iso === previewEnd) return true
    if (highlightEnd && startDate && compareIso(iso, startDate) > 0 && compareIso(iso, highlightEnd) < 0) return true
    return false
  }

  function dayVisualClasses(
    cell: CalendarDay,
    weekCells: (CalendarDay | null)[],
    indexInWeek: number,
  ): { wrapperClass: string; circleClass: string } {
    const iso = cell.iso
    const isPast = compareIso(iso, todayIso) < 0
    const isBeforeStart = phase === 'end' && compareIso(iso, startDate) < 0
    const disabled = isPast || isBeforeStart
    const isStart = iso === startDate
    const isEnd = iso === endDate || (!endDate && iso === previewEnd)
    const isSingle = isStart && iso === endDate
    const highlighted = isHighlighted(iso)

    const leftCell = weekCells[indexInWeek - 1]
    const rightCell = weekCells[indexInWeek + 1]
    const roundStart = !leftCell || !isHighlighted(leftCell.iso)
    const roundEnd = !rightCell || !isHighlighted(rightCell.iso)

    const wrapperClasses = ['h-11 sm:h-10 flex items-center justify-center']
    if (highlighted) {
      if (!isSingle) wrapperClasses.push('bg-brand-lavender/60')
      if (roundStart) wrapperClasses.push('rounded-s-full')
      if (roundEnd) wrapperClasses.push('rounded-e-full')
    }

    let circleClass = 'text-brand-navy hover:bg-brand-lavender/70'
    if (disabled) circleClass = 'text-text-muted cursor-not-allowed'
    else if (isStart || isEnd || isSingle) circleClass = 'bg-brand-navy text-white hover:bg-brand-navy'

    return { wrapperClass: wrapperClasses.join(' '), circleClass }
  }

  function handleDayKeyDown(e: KeyboardEvent<HTMLButtonElement>, iso: string) {
    const stepByKey: Record<string, number> = {
      ArrowLeft: rtl ? 1 : -1,
      ArrowRight: rtl ? -1 : 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }
    const step = stepByKey[e.key]
    if (step === undefined) return
    e.preventDefault()
    const { year, month0, day } = parseIso(iso)
    const targetDate = new Date(year, month0, day + step)
    const targetIso = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`
    const target = dayRefs.current.get(targetIso)
    if (target) target.focus()
    // If the target date isn't in the currently-rendered month(s), arrow
    // navigation simply stops at the edge — Tab/Shift+Tab and the
    // month-nav buttons remain the reliable way to move further, a
    // deliberate scope limit rather than auto-paging months mid-keypress.
  }

  function renderMonth(year: number, month0: number, hidden: boolean) {
    const grid = buildMonthGrid(year, month0)
    return (
      <div className={hidden ? 'hidden sm:block' : undefined}>
        <p className="mb-3 text-center text-sm font-semibold text-brand-navy">
          {formatMonthLabel(year, month0, i18n.language)}
        </p>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          {weekdays.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="mt-1 flex flex-col gap-0.5">
          {grid.weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((cell, ci) => {
                if (!cell) return <div key={ci} className="h-11 sm:h-10" />
                const isPast = compareIso(cell.iso, todayIso) < 0
                const isBeforeStart = phase === 'end' && compareIso(cell.iso, startDate) < 0
                const disabled = isPast || isBeforeStart
                const isToday = cell.iso === todayIso
                const selected = cell.iso === startDate || cell.iso === endDate
                const { wrapperClass, circleClass } = dayVisualClasses(cell, week, ci)
                return (
                  <div key={cell.iso} className={wrapperClass}>
                    <button
                      ref={(el) => {
                        if (el) dayRefs.current.set(cell.iso, el)
                        else dayRefs.current.delete(cell.iso)
                      }}
                      type="button"
                      disabled={disabled}
                      aria-disabled={disabled || undefined}
                      aria-pressed={selected}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={formatFullDate(cell.iso, i18n.language)}
                      onClick={() => handleDayClick(cell.iso)}
                      onMouseEnter={() => phase === 'end' && setHoverIso(cell.iso)}
                      onMouseLeave={() => setHoverIso(null)}
                      onFocus={() => phase === 'end' && setHoverIso(cell.iso)}
                      onKeyDown={(e) => handleDayKeyDown(e, cell.iso)}
                      className={
                        'relative flex h-11 w-11 items-center justify-center rounded-full text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed sm:h-10 sm:w-10 ' +
                        circleClass
                      }
                    >
                      {cell.day}
                      {isToday && !selected && (
                        <span aria-hidden="true" className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-gold" />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const placeholder = t('searchWidget.calendar.selectDates')
  const daysLabel = days !== null ? t('searchWidget.calendar.days', { count: days }) : null

  return (
    <div>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={
          'flex w-full items-center justify-between gap-2 rounded-lg border bg-white text-start text-sm text-brand-navy outline-none transition-colors focus:border-brand-navy focus:ring-1 focus:ring-brand-navy ' +
          (open ? 'border-brand-gold ring-1 ring-brand-gold' : 'border-border') + ' ' +
          (row ? 'max-w-full divide-x divide-brand-navy/10 px-3 py-2.5 sm:whitespace-nowrap' : 'divide-x divide-brand-navy/10')
        }
      >
        {row ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-1 py-0.5">
            <span className="ltr-nums min-w-0 font-medium">
              {startDate ? formatShortDate(startDate, i18n.language) : t('searchWidget.calendar.pickup')}
            </span>
            <ArrowIcon className="h-3.5 w-3.5 shrink-0 text-text-muted rtl:rotate-180" />
            <span className="ltr-nums min-w-0 font-medium">
              {endDate ? formatShortDate(endDate, i18n.language) : t('searchWidget.calendar.return')}
            </span>
            {daysLabel && <span className="ms-1 rounded-full bg-brand-lavender/60 px-2 py-0.5 text-xs font-semibold text-brand-navy">{daysLabel}</span>}
          </span>
        ) : (
          <>
            <span className="min-w-0 flex-1 px-3 py-2.5">
              <span className="block text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t('searchWidget.calendar.pickup')}
              </span>
              <span className="ltr-nums mt-0.5 block truncate font-medium">
                {startDate ? formatLongDate(startDate, i18n.language) : placeholder}
              </span>
            </span>
            <span className="min-w-0 flex-1 px-3 py-2.5">
              <span className="block text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t('searchWidget.calendar.return')}
              </span>
              <span className="ltr-nums mt-0.5 block truncate font-medium">
                {endDate
                  ? formatLongDate(endDate, i18n.language)
                  : startDate
                    ? t('searchWidget.calendar.selectReturnDate')
                    : placeholder}
              </span>
            </span>
            {daysLabel && (
              <span className="shrink-0 self-center px-3 text-xs font-semibold text-brand-navy">{daysLabel}</span>
            )}
          </>
        )}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('searchWidget.calendar.title')}
        closeLabel={t('common.close')}
        maxWidthClassName="max-w-2xl"
      >
        <div>
          <div className="mb-4 flex items-stretch justify-between gap-3 rounded-xl border border-brand-navy/10 bg-brand-lavender/20 p-3">
            <div className={'flex-1 ' + (phase === 'start' ? 'opacity-100' : 'opacity-70')}>
              <span className="block text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t('searchWidget.calendar.pickup')}
              </span>
              <span className="ltr-nums block text-sm font-semibold text-brand-navy">
                {startDate ? formatLongDate(startDate, i18n.language) : '—'}
              </span>
            </div>
            <div className="w-px shrink-0 bg-brand-navy/10" aria-hidden="true" />
            <div className={'flex-1 ' + (phase === 'end' ? 'opacity-100' : 'opacity-70')}>
              <span className="block text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t('searchWidget.calendar.return')}
              </span>
              <span className="ltr-nums block text-sm font-semibold text-brand-navy">
                {endDate
                  ? formatLongDate(endDate, i18n.language)
                  : startDate
                    ? t('searchWidget.calendar.selectReturnDate')
                    : '—'}
              </span>
            </div>
          </div>
          {daysLabel && (
            <p className="ltr-nums mb-4 text-center text-sm font-semibold text-brand-navy">{daysLabel}</p>
          )}

          <div className="relative px-8">
            <button
              type="button"
              aria-label={t('searchWidget.calendar.previousMonth')}
              disabled={atFloorMonth}
              onClick={() => goToMonth(-1)}
              className="absolute start-0 top-1 rounded-md p-1.5 text-text-muted hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronIcon className="h-4 w-4 rtl:rotate-180" />
            </button>
            <button
              type="button"
              aria-label={t('searchWidget.calendar.nextMonth')}
              onClick={() => goToMonth(1)}
              className="absolute end-0 top-1 rounded-md p-1.5 text-text-muted hover:bg-surface-muted"
            >
              <ChevronIcon className="h-4 w-4 rotate-180 rtl:rotate-0" />
            </button>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {renderMonth(viewYear, viewMonth0, false)}
              {renderMonth(rightMonth.year, rightMonth.month0, true)}
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setOpen(false)}
            disabled={!validation.valid}
            fullWidthOnMobile
            className="mt-5"
          >
            {t('searchWidget.calendar.done')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path d="M12.5 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
