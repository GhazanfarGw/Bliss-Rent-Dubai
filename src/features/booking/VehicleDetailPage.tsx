import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { categoryLabel } from '@/lib/categoryName'
import { ArrowLeft, KeyRound, LifeBuoy, MapPin, Plane } from 'lucide-react'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import {
  fetchAllAvailableVehicles,
  fetchLocations,
  fetchVehicleById,
  isVehicleAvailable,
  BookingApiError,
} from '@/features/booking/api'
import { SearchWidget } from '@/features/booking/SearchWidget'
import { VehicleGallery } from '@/features/booking/VehicleGallery'
import { VehicleHighlights } from '@/features/booking/VehicleHighlights'
import { VehicleSpecs } from '@/features/booking/VehicleSpecs'
import { VehicleCard } from '@/features/booking/VehicleCard'
import { Dialog } from '@/features/shared/ui/Dialog'
import { CurrencySymbol } from '@/features/shared/ui/CurrencySymbol'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import { quoteForDays, cheapestHeadlineRate, TERM_LABELS } from '@/lib/pricing'
import { rentalDays, validateDateRange } from '@/lib/dateRange'
import { isCompleteCriteria, searchParamsToCriteria } from '@/features/booking/searchParams'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import { metaSpecSummary } from '@/lib/vehicleSpecs'
import type { Location, SearchCriteria, VehicleWithDetails } from '@/types/domain'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not_found' }
  | { status: 'loaded'; vehicle: VehicleWithDetails }

/**
 * Real, per-vehicle meta description built from the vehicle's own
 * already-loaded make/model/year/category/engine/power/seats/transmission and
 * its cheapest real listed rate — never a generic "rent a car" line
 * duplicated across every vehicle page, and nothing invented: every
 * fact here is a field already rendered elsewhere on this same page.
 */
function buildVehicleMetaDescription(vehicle: VehicleWithDetails): string {
  const category = vehicle.vehicle_categories?.name
  const rate = cheapestHeadlineRate(vehicle.pricing)
  const pricePart = rate ? ` From AED ${rate.client_price}/day.` : ''
  const categoryPart = category ? ` — ${category} rental` : ''
  const specs = metaSpecSummary(vehicle)
  const specsPart = specs ? `, ${specs}` : ''
  return `Rent the ${vehicle.make} ${vehicle.model} (${vehicle.model_year}) in Dubai${categoryPart}${specsPart}, ${vehicle.seats} seats, ${vehicle.transmission} transmission.${pricePart} Book online with Bliss Rent.`
}

export function VehicleDetailPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const criteria = searchParamsToCriteria(searchParams)
  const completeCriteria = isCompleteCriteria(criteria) ? criteria : null
  const hasDates = Boolean(completeCriteria && validateDateRange(completeCriteria.startDate, completeCriteria.endDate).valid)

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [locations, setLocations] = useState<Location[]>([])
  const [availability, setAvailability] = useState<'checking' | 'available' | 'unavailable' | 'unknown'>(
    hasDates ? 'checking' : 'unknown',
  )
  const [similarVehicles, setSimilarVehicles] = useState<VehicleWithDetails[] | null>(null)
  // The trip popup: pickup, return, dates and time are chosen once, in one place.
  const [tripDialogOpen, setTripDialogOpen] = useState(false)
  const [tripBusy, setTripBusy] = useState(false)
  const [tripError, setTripError] = useState<string | null>(null)
  const openTripDialog = useCallback(() => {
    setTripError(null)
    setTripDialogOpen(true)
  }, [])
  const closeTripDialog = useCallback(() => setTripDialogOpen(false), [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setState({ status: 'loading' })
    fetchVehicleById(id)
      .then((vehicle) => {
        if (cancelled) return
        setState(vehicle ? { status: 'loaded', vehicle } : { status: 'not_found' })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: err instanceof BookingApiError || err instanceof Error ? err.message : 'Something went wrong.',
        })
      })
    fetchLocations().then((data) => {
      if (!cancelled) setLocations(data)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id || !hasDates) {
      setAvailability('unknown')
      return
    }
    let cancelled = false
    setAvailability('checking')
    isVehicleAvailable(id, criteria.startDate!, criteria.endDate!)
      .then((ok) => {
        if (!cancelled) setAvailability(ok ? 'available' : 'unavailable')
      })
      .catch(() => {
        if (!cancelled) setAvailability('unknown')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, hasDates, criteria.startDate, criteria.endDate])

  const loadedCategoryId = state.status === 'loaded' ? state.vehicle.category_id : null
  const loadedVehicleId = state.status === 'loaded' ? state.vehicle.id : null

  // "Similar vehicles" — other vehicles sharing this one's real category,
  // from the exact same live, available-only fleet query
  // FeaturedVehicles/VehicleCategoriesSection already use (no second
  // fleet-fetching path, no invented recommendations). Absent entirely
  // until resolved, and simply doesn't render on failure or when there
  // are none — never a fabricated "you may also like" list.
  useEffect(() => {
    if (!loadedCategoryId || !loadedVehicleId) return
    let cancelled = false
    fetchAllAvailableVehicles()
      .then((vehicles) => {
        if (cancelled) return
        setSimilarVehicles(
          vehicles.filter((v) => v.category_id === loadedCategoryId && v.id !== loadedVehicleId).slice(0, 4),
        )
      })
      .catch(() => {
        if (!cancelled) setSimilarVehicles(null)
      })
    return () => {
      cancelled = true
    }
  }, [loadedCategoryId, loadedVehicleId])

  useDocumentTitle(state.status === 'loaded' ? `${state.vehicle.make} ${state.vehicle.model}` : null)
  useMetaDescription(state.status === 'loaded' ? buildVehicleMetaDescription(state.vehicle) : null)

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
        <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
      </div>
    )
  }

  if (state.status === 'not_found') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <StateMessage
          title={t('vehicleDetail.notFoundTitle')}
          body={t('vehicleDetail.notFoundBody')}
          action={
            <Link to="/search" className="text-sm font-semibold text-brand-navy underline">
              {t('vehicleDetail.backToSearch')}
            </Link>
          }
        />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <StateMessage tone="error" title={t('vehicleDetail.errorTitle')} body={state.message} />
      </div>
    )
  }

  const { vehicle } = state
  const days = hasDates ? rentalDays(criteria.startDate!, criteria.endDate!) : null
  const quote = days ? quoteForDays(vehicle.pricing, days) : null
  const headline = cheapestHeadlineRate(vehicle.pricing)
  const pickup = locations.find((l) => l.id === criteria.pickupLocationId)
  const dropoff = locations.find((l) => l.id === criteria.dropoffLocationId)
  const route = pickup ? (dropoff && dropoff.id !== pickup.id ? `${pickup.name} → ${dropoff.name}` : pickup.name) : ''
  const formatDay = (iso: string | undefined, options: Intl.DateTimeFormatOptions) =>
    iso ? new Intl.DateTimeFormat(i18n.language, options).format(new Date(`${iso}T00:00:00`)) : ''
  const tripDates = hasDates
    ? `${formatDay(criteria.startDate, { day: 'numeric', month: 'short' })} – ${formatDay(criteria.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : ''

  const checking = hasDates && availability === 'checking'
  // Only a checked, free car goes straight to booking; anything else re-opens the trip popup.
  const readyToBook = hasDates && availability === 'available'
  const bookLabel = checking
    ? t('vehicleDetail.checking')
    : hasDates && !readyToBook
      ? t('vehicleDetail.changeDates')
      : t('vehicleDetail.bookNow')

  function handleBookNow() {
    if (!id) return
    if (readyToBook && completeCriteria) {
      navigate(`/checkout/${id}/customer?${criteriaToSearchParams(completeCriteria).toString()}`)
      return
    }
    openTripDialog()
  }

  /** The popup's "Confirm & continue": make sure this car is free for those dates, then go on to the booking steps. */
  async function handleTripConfirmed(next: SearchCriteria) {
    if (!id || tripBusy) return
    setTripBusy(true)
    setTripError(null)
    try {
      const free = await isVehicleAvailable(id, next.startDate, next.endDate)
      if (!free) {
        setTripError(t('vehicleDetail.tripUnavailable'))
        return
      }
      setTripDialogOpen(false)
      navigate(`/checkout/${id}/customer?${criteriaToSearchParams(next).toString()}`)
    } catch {
      setTripError(t('vehicleDetail.tripCheckFailed'))
    } finally {
      setTripBusy(false)
    }
  }

  // "View all" for this car's category, keeping any dates already chosen.
  const categoryLinkParams = new URLSearchParams(searchParams)
  categoryLinkParams.set('category', vehicle.category_id)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/search" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-brand-navy">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        {t('vehicleDetail.backToResults')}
      </Link>

      {/* Three blocks: photos, the booking panel, and the car's details. On phones they
          stack in that order, so the booking panel is never buried under a long spec
          sheet; from `lg` the photos and details share the left column and the booking
          panel spans both rows on the right, sticky. */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <VehicleGallery images={vehicle.vehicle_images} alt={`${vehicle.make} ${vehicle.model}`} />
        </div>

        {/* The booking panel is deliberately short: what the car is, its price, one
            button. The full specifications live below the photos, and the trip (dates
            and places) is chosen in a popup rather than in three separate editors. */}
        <section className="rounded-2xl border border-brand-navy/10 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-brand-navy">
              {vehicle.make} {vehicle.model}
            </h1>
            {vehicle.vehicle_categories && (
              <span className="rounded-full bg-brand-lavender px-3 py-1 text-xs font-medium text-brand-navy">
                {categoryLabel(t, vehicle.vehicle_categories.name)}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-text-muted">
            {vehicle.model_year} · {t(`vehicleCard.transmission.${vehicle.transmission}`, { defaultValue: vehicle.transmission })} ·{' '}
            {vehicle.seats} {t('vehicleCard.seats')}
          </p>

          {/* Power, torque, 0-100, top speed and engine as icon tiles — the numbers people
              compare, visible as soon as the page opens (on a phone this box is right
              under the photos). Nothing shows for facts that are not entered. */}
          <VehicleHighlights vehicle={vehicle} />

          <div className="mt-5 border-t border-brand-navy/10 pt-5">
            {quote ? (
              <>
                <p className="text-2xl font-bold text-brand-navy">
                  <CurrencySymbol currency={quote.currency} /> {quote.totalPrice.toLocaleString()}
                </p>
                <p className="text-xs text-text-muted">
                  <CurrencySymbol currency={quote.currency} /> {quote.unitPrice.toLocaleString()} {TERM_LABELS[quote.term]} · {days}{' '}
                  {t(days === 1 ? 'common.day' : 'common.days')}
                </p>
              </>
            ) : headline ? (
              <>
                <p className="text-2xl font-bold text-brand-navy">
                  <CurrencySymbol currency={headline.currency} /> {headline.client_price.toLocaleString()}
                </p>
                <p className="text-xs text-text-muted">
                  {TERM_LABELS[headline.term]} — {t('vehicleDetail.selectDatesForQuote')}
                </p>
              </>
            ) : (
              <p className="text-sm font-medium text-text-muted">{t('vehicleDetail.pricingSoon')}</p>
            )}

            {/* Only once the customer has chosen a trip: a short summary with one Edit link. */}
            {hasDates && (
              <div className="mt-4 border border-brand-navy/10 bg-surface-warm p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-navy">
                      {tripDates} · {days} {t(days === 1 ? 'common.day' : 'common.days')}
                    </p>
                    {route && <p className="mt-1 break-words text-xs leading-5 text-text-muted">{route}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={openTripDialog}
                    aria-haspopup="dialog"
                    className="shrink-0 text-xs font-semibold text-brand-gold-dark underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                  >
                    {t('vehicleDetail.editTrip')}
                  </button>
                </div>
                {pickup?.type === 'airport' && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand-gold-dark">
                    <Plane className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {pickup.airport_code
                      ? t('vehicleDetail.airportPickupWithCode', { code: pickup.airport_code })
                      : t('vehicleDetail.airportPickup')}
                  </p>
                )}
                <p className="mt-2 text-xs font-medium" aria-live="polite">
                  <AvailabilityBadge state={availability} />
                </p>
              </div>
            )}

            <button
              type="button"
              disabled={checking}
              onClick={handleBookNow}
              aria-haspopup={readyToBook ? undefined : 'dialog'}
              className="mt-5 w-full rounded-full bg-brand-gold px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-gold-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
            >
              {bookLabel}
            </button>
            <p className="mt-2 text-center text-xs text-text-muted">{t('vehicleDetail.paymentNote')}</p>

            {/* Real, already-established site-wide policies — the same claims
                WhyChooseSection/DubaiOnlyBadge already make elsewhere, as quiet lines
                rather than three outlined badges. */}
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-brand-navy/10 pt-4 text-xs text-text-muted lg:flex-col lg:gap-y-2">
              <li className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
                {t('common.dubaiOnly')}
              </li>
              <li className="flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
                {t('vehicleDetail.selfDriveBadge')}
              </li>
              <li className="flex items-center gap-2">
                <LifeBuoy className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
                {t('vehicleDetail.supportBadge')}
              </li>
            </ul>
          </div>
        </section>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <VehicleSpecs vehicle={vehicle} />
        </div>
      </div>

      {similarVehicles && similarVehicles.length > 0 && (
        <section className="mt-12 border-t border-brand-navy/10 pt-8 sm:mt-14 sm:pt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="min-w-0 text-xl font-semibold text-brand-navy sm:text-2xl">
              {vehicle.vehicle_categories
                ? t('vehicleDetail.similarVehicles.title', { category: categoryLabel(t, vehicle.vehicle_categories.name) })
                : t('vehicleDetail.similarVehicles.titleGeneric')}
            </h2>
            <Link
              to={`/search?${categoryLinkParams.toString()}`}
              className="shrink-0 text-sm font-semibold text-brand-gold-dark underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            >
              {t('vehicleDetail.similarVehicles.viewAll')}
            </Link>
          </div>

          {/* A swipeable row on phones (the next card peeks in), a grid from `sm` up.
              Each card sits in a flex wrapper so they all stretch to the same height. */}
          <div className="-mx-4 mt-5 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {similarVehicles.map((similar) => (
              <div key={similar.id} className="flex w-[78%] max-w-[320px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <VehicleCard
                  vehicle={similar}
                  detailHref={`/vehicles/${similar.id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog
        open={tripDialogOpen}
        onClose={closeTripDialog}
        title={t('vehicleDetail.chooseTripDetails')}
        closeLabel={t('common.close')}
        mobileSheet
        maxWidthClassName="max-w-3xl"
      >
        <p className="mb-5 text-sm leading-6 text-text-muted">{t('vehicleDetail.chooseTripDetailsBody')}</p>
        <SearchWidget
          layout="card"
          chromeless
          initialValues={completeCriteria ?? undefined}
          submitLabel={t('vehicleDetail.confirmTrip')}
          submitBusy={tripBusy}
          onSearch={(next) => void handleTripConfirmed(next)}
        />
        {tripError && (
          <p role="alert" className="mt-4 border border-error/25 bg-error-bg px-4 py-3 text-sm font-medium text-error">
            {tripError}
          </p>
        )}
      </Dialog>
    </div>
  )
}

/** Whether the car is free for the chosen dates — shown only once dates are chosen, so there is no "unknown" wording. */
function AvailabilityBadge({ state }: { state: 'checking' | 'available' | 'unavailable' | 'unknown' }) {
  const { t } = useTranslation()
  if (state === 'checking') return <span className="text-text-muted">{t('vehicleDetail.checking')}</span>
  if (state === 'available') return <span className="text-success">{t('vehicleDetail.available')}</span>
  if (state === 'unavailable') return <span className="text-error">{t('vehicleDetail.unavailable')}</span>
  return null
}
