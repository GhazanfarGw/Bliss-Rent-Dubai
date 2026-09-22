import { CalendarDays, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Everything the trip summary shows, already formatted for the current language. */
export interface TripView {
  hasDates: boolean
  /** Short range for the compact pill, e.g. "Sep 24 – Sep 27, 2026". */
  rangeLabel: string
  startLabel: string
  endLabel: string
  /** Pickup time of day, e.g. "10:00 AM"; empty when the search carries none. */
  time: string
  days: number
  pickup: string
  dropoff: string
  onEdit: () => void
}

const EDIT_LINK =
  'inline-flex items-center gap-1 text-xs font-medium text-brand-gold-dark underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold'

/**
 * The customer's trip as a card at the top of the sticky filter column (desktop),
 * so what they picked — where, and when — stays in view however far they scroll
 * through the cars. Without dates it is a prompt to add them.
 */
export function TripCard({ trip }: { trip: TripView }) {
  const { t } = useTranslation()
  const { hasDates, onEdit } = trip

  return (
    <section
      aria-label={t('searchResults.yourTrip')}
      className="shrink-0 border border-t-2 border-brand-navy/10 border-t-brand-gold bg-white shadow-[0_18px_45px_rgba(7,10,26,0.06)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-brand-navy/10 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
          <CalendarDays className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
          {t('searchResults.yourTrip')}
        </h2>
        {hasDates && (
          <button type="button" onClick={onEdit} aria-haspopup="dialog" className={EDIT_LINK}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            {t('searchResults.editSearch')}
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {hasDates ? (
          <>
            <ol className="space-y-4">
              <TripStop
                label={t('searchWidget.pickupLocation')}
                place={trip.pickup}
                when={trip.time ? `${trip.startLabel} · ${trip.time}` : trip.startLabel}
              />
              <TripStop last label={t('searchWidget.returnLocation')} place={trip.dropoff} when={trip.endLabel} />
            </ol>
            <p className="mt-4 flex items-center justify-between border-t border-brand-navy/10 pt-3 text-xs text-text-muted">
              <span>{t('searchWidget.duration')}</span>
              <span className="font-medium text-brand-navy">
                {trip.days} {t(trip.days === 1 ? 'common.day' : 'common.days')}
              </span>
            </p>
          </>
        ) : (
          <>
            <p className="text-xs leading-5 text-text-muted">{t('searchResults.addDatesHint')}</p>
            <button
              type="button"
              onClick={onEdit}
              aria-haspopup="dialog"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 bg-brand-gold px-4 text-sm font-semibold text-white transition-all hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2"
            >
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {t('searchResults.addDates')}
            </button>
          </>
        )}
      </div>
    </section>
  )
}

/** One end of the trip on a small vertical timeline: an open dot for pick-up, a filled one for return. */
function TripStop({ label, place, when, last = false }: { label: string; place: string; when: string; last?: boolean }) {
  return (
    <li className="relative ps-6">
      <span
        aria-hidden="true"
        className={'absolute start-0 top-1 h-2.5 w-2.5 rounded-full border-2 border-brand-gold ' + (last ? 'bg-brand-gold' : 'bg-white')}
      />
      {!last && <span aria-hidden="true" className="absolute start-[4.5px] top-4 -bottom-3 w-px bg-brand-navy/15" />}
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <p className="mt-0.5 break-words text-[13px] font-medium leading-snug text-brand-navy">{place}</p>
      <p className="mt-0.5 text-xs text-text-muted">{when}</p>
    </li>
  )
}

/**
 * The same trip as one compact two-line button for phones and tablets, where
 * there is no filter column. It sits in the sticky filter toolbar, so it too
 * stays on screen while the cars scroll.
 */
export function TripPill({ trip }: { trip: TripView }) {
  const { t } = useTranslation()
  const { hasDates } = trip
  const route = trip.dropoff && trip.dropoff !== trip.pickup ? `${trip.pickup} → ${trip.dropoff}` : trip.pickup

  return (
    <button
      type="button"
      onClick={trip.onEdit}
      aria-haspopup="dialog"
      className="flex w-full items-center gap-3 border border-brand-navy/12 bg-white px-3 py-2 text-start transition-colors hover:border-brand-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center bg-brand-gold/10 text-brand-gold">
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-brand-navy">
          {hasDates ? `${trip.rangeLabel} · ${trip.days} ${t(trip.days === 1 ? 'common.day' : 'common.days')}` : t('searchResults.addDates')}
        </span>
        <span className="block truncate text-xs text-text-muted">{hasDates ? route : t('searchResults.addDatesHint')}</span>
      </span>
      {hasDates && <Pencil className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />}
    </button>
  )
}
