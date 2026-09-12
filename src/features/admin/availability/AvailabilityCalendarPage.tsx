import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchVehicles } from '@/features/admin/fleet/adminFleetApi'
import { fetchVehicleBookingsInRange, type CalendarBooking } from '@/features/admin/availability/adminAvailabilityApi'
import { buildMonthGrid } from '@/features/admin/availability/calendarGrid'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import type { AdminVehicleWithDetails } from '@/types/domain'

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function AvailabilityCalendarPage() {
  const { t } = useTranslation()
  const [vehicles, setVehicles] = useState<AdminVehicleWithDetails[]>([])
  const [vehiclesError, setVehiclesError] = useState<string | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month0: now.getMonth() }
  })
  const [bookings, setBookings] = useState<CalendarBooking[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchVehicles()
      .then((v) => {
        setVehicles(v)
        if (v.length > 0) setSelectedVehicleId((prev) => prev || v[0].id)
      })
      .catch((err: unknown) => setVehiclesError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric')))
  }, [t])

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month0), [cursor])
  const rangeStart = grid[0]?.date
  const rangeEnd = grid[grid.length - 1]?.date

  useEffect(() => {
    if (!selectedVehicleId || !rangeStart || !rangeEnd) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchVehicleBookingsInRange(selectedVehicleId, rangeStart, rangeEnd)
      .then((data) => {
        if (!cancelled) setBookings(data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedVehicleId, rangeStart, rangeEnd, t])

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null

  function bookingForDate(date: string): CalendarBooking | null {
    return bookings.find((b) => b.start_date <= date && date <= b.end_date) ?? null
  }

  const monthLabel = new Date(cursor.year, cursor.month0, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div>
      <AdminPageHeader title={t('admin.nav.availability')} description={t('admin.availability.subtitle')} />

      {vehiclesError && <StateMessage tone="error" title={t('admin.errorGeneric')} body={vehiclesError} />}

      {!vehiclesError && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.make} {v.model} — {v.plate_number}
                </option>
              ))}
            </select>

            <div className="ms-auto flex items-center gap-2">
              <button
                type="button"
                aria-label={t('common.previousMonth')}
                onClick={() => setCursor((c) => (c.month0 === 0 ? { year: c.year - 1, month0: 11 } : { year: c.year, month0: c.month0 - 1 }))}
                className="rounded-lg border border-border px-2.5 py-1.5 text-brand-navy hover:bg-brand-lavender"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </button>
              <span className="min-w-[9rem] text-center text-sm font-semibold text-brand-navy">{monthLabel}</span>
              <button
                type="button"
                aria-label={t('common.nextMonth')}
                onClick={() => setCursor((c) => (c.month0 === 11 ? { year: c.year + 1, month0: 0 } : { year: c.year, month0: c.month0 + 1 }))}
                className="rounded-lg border border-border px-2.5 py-1.5 text-brand-navy hover:bg-brand-lavender"
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </button>
            </div>
          </div>

          {selectedVehicle?.status === 'maintenance' && (
            <div className="mb-4 rounded-lg border border-error/25 bg-error-bg px-3 py-2 text-sm text-error">
              {t('admin.availability.underMaintenance')}
            </div>
          )}
          {selectedVehicle?.status === 'retired' && (
            <div className="mb-4 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted">
              {t('admin.availability.retired')}
            </div>
          )}

          <div className="rounded-2xl border border-brand-navy/10 bg-white p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-text-muted">
              {WEEKDAY_KEYS.map((wd) => (
                <div key={wd} className="py-1">
                  {t(`admin.availability.weekday.${wd}`)}
                </div>
              ))}
            </div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Spinner className="h-6 w-6" />
              </div>
            ) : error ? (
              <p className="py-6 text-center text-sm text-error">{error}</p>
            ) : (
              <div className="mt-1 grid grid-cols-7 gap-1">
                {grid.map((cell) => {
                  const booking = bookingForDate(cell.date)
                  return (
                    <div
                      key={cell.date}
                      className={
                        'min-h-[64px] rounded-lg border p-1.5 text-xs ' +
                        (cell.inMonth ? 'border-brand-navy/10 bg-white' : 'border-transparent bg-surface-muted text-text-muted/60') +
                        (booking ? ' ' + dayCellClass(booking.status) : '')
                      }
                    >
                      <div className="font-semibold">{Number(cell.date.slice(-2))}</div>
                      {booking && cell.inMonth && (
                        <div className="mt-1 truncate" title={booking.customer_name}>
                          {t(`admin.status.${booking.status}`)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-muted">
            <LegendDot className="bg-brand-lavender" label={t('admin.status.confirmed')} />
            <LegendDot className="bg-warning" label={t('admin.status.active')} />
            <LegendDot className="bg-border" label={t('admin.status.pending_payment')} />
          </div>
        </>
      )}
    </div>
  )
}

function dayCellClass(status: string): string {
  if (status === 'active') return 'bg-warning-bg border-warning/30'
  if (status === 'confirmed') return 'bg-brand-lavender border-brand-navy/10'
  if (status === 'pending_payment') return 'bg-surface-muted border-border'
  return ''
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={'h-2.5 w-2.5 rounded-full ' + className} />
      {label}
    </span>
  )
}
