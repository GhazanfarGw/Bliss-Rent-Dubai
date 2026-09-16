import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, KeyRound, LifeBuoy, Plane } from 'lucide-react'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import {
  fetchAllAvailableVehicles,
  fetchLocations,
  fetchVehicleById,
  isVehicleAvailable,
  BookingApiError,
} from '@/features/booking/api'
import { VehicleGallery } from '@/features/booking/VehicleGallery'
import { VehicleCard } from '@/features/booking/VehicleCard'
import { CitySelect, LocationPickerButton } from '@/features/booking/LocationField'
import { DateRangePicker } from '@/features/booking/DateRangePicker'
import { DubaiOnlyBadge } from '@/features/shared/DubaiOnlyBadge'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import { quoteForDays, cheapestHeadlineRate, TERM_LABELS } from '@/lib/pricing'
import { rentalDays, validateDateRange } from '@/lib/dateRange'
import { isCompleteCriteria, searchParamsToCriteria } from '@/features/booking/searchParams'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import type { Location, SearchCriteria, VehicleWithDetails } from '@/types/domain'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not_found' }
  | { status: 'loaded'; vehicle: VehicleWithDetails }

/**
 * Real, per-vehicle meta description built from the vehicle's own
 * already-loaded make/model/year/category/seats/transmission and its
 * cheapest real listed rate — never a generic "rent a car" line
 * duplicated across every vehicle page, and nothing invented: every
 * fact here is a field already rendered elsewhere on this same page.
 */
function buildVehicleMetaDescription(vehicle: VehicleWithDetails): string {
  const category = vehicle.vehicle_categories?.name
  const rate = cheapestHeadlineRate(vehicle.pricing)
  const pricePart = rate ? ` From AED ${rate.client_price}/day.` : ''
  const categoryPart = category ? ` — ${category} rental` : ''
  return `Rent the ${vehicle.make} ${vehicle.model} (${vehicle.model_year}) in Dubai${categoryPart}, ${vehicle.seats} seats, ${vehicle.transmission} transmission.${pricePart} Book online with Bliss Rent.`
}

export function VehicleDetailPage() {
  const { t } = useTranslation()
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
  const [quickEditor, setQuickEditor] = useState<'dates' | 'pickup' | 'dropoff' | null>(null)
  const [quickCriteria, setQuickCriteria] = useState<Partial<SearchCriteria>>(criteria)
  const [quickPickupCity, setQuickPickupCity] = useState('Dubai')
  const [similarVehicles, setSimilarVehicles] = useState<VehicleWithDetails[] | null>(null)

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
  const displayPickup = locations.find((l) => l.id === quickCriteria.pickupLocationId) ?? pickup
  const displayDropoff = locations.find((l) => l.id === quickCriteria.dropoffLocationId) ?? dropoff
  const displayHasDates = Boolean(
    quickCriteria.startDate && quickCriteria.endDate && validateDateRange(quickCriteria.startDate, quickCriteria.endDate).valid,
  )

  function handleSearch(next: Parameters<typeof criteriaToSearchParams>[0]) {
    navigate(`/vehicles/${id}?${criteriaToSearchParams(next).toString()}`)
  }

  function updateQuickCriteria(next: Partial<SearchCriteria>) {
    setQuickCriteria(next)
    if (isCompleteCriteria(next) && validateDateRange(next.startDate, next.endDate).valid) {
      handleSearch(next)
      setQuickEditor(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/search" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-brand-navy">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        {t('vehicleDetail.backToResults')}
      </Link>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="min-w-0">
          <VehicleGallery images={vehicle.vehicle_images} alt={`${vehicle.make} ${vehicle.model}`} />
        </div>

        <section className="rounded-none border border-brand-navy/10 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-brand-navy">
                {vehicle.make} {vehicle.model}
              </h1>
              {vehicle.vehicle_categories && (
                <span className="rounded-none bg-brand-lavender px-3 py-1 text-xs font-medium text-brand-navy">
                  {vehicle.vehicle_categories.name}
                </span>
              )}
            </div>
            {vehicle.vehicle_categories?.description && (
              <p className="mt-2 text-sm leading-6 text-text-muted">{vehicle.vehicle_categories.description}</p>
            )}

            <h2 className="mt-6 text-sm font-semibold text-brand-navy">{t('vehicleDetail.specifications')}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Spec label={t('vehicleDetail.year')} value={String(vehicle.model_year)} />
              <Spec label={t('vehicleDetail.transmission')} value={vehicle.transmission} capitalize />
              <Spec label={t('vehicleDetail.seats')} value={String(vehicle.seats)} />
              {vehicle.vehicle_categories && <Spec label={t('vehicleDetail.category')} value={vehicle.vehicle_categories.name} />}
            </dl>
          </div>

          <div className="mt-6 border-t border-brand-navy/10 pt-5">
            {quote ? (
              <>
                <p className="text-2xl font-bold text-brand-navy">
                  {quote.currency} {quote.totalPrice.toLocaleString()}
                </p>
                <p className="text-xs text-text-muted">
                  {quote.currency} {quote.unitPrice.toLocaleString()} {TERM_LABELS[quote.term]} · {days}{' '}
                  {t(days === 1 ? 'common.day' : 'common.days')}
                </p>
              </>
            ) : headline ? (
              <>
                <p className="text-2xl font-bold text-brand-navy">
                  {headline.currency} {headline.client_price.toLocaleString()}
                </p>
                <p className="text-xs text-text-muted">
                  {TERM_LABELS[headline.term]} — {t('vehicleDetail.selectDatesForQuote')}
                </p>
              </>
            ) : (
              <p className="text-sm font-medium text-text-muted">{t('vehicleDetail.pricingSoon')}</p>
            )}

            <div className="mt-4 space-y-2 border-t border-brand-navy/10 pt-4 text-sm">
              <EditableRow label={t('vehicleDetail.dates')} value={displayHasDates ? `${quickCriteria.startDate} → ${quickCriteria.endDate}` : t('vehicleDetail.notSelected')} onClick={() => setQuickEditor('dates')} />
              <EditableRow label={t('vehicleDetail.pickup')} value={displayPickup?.name ?? t('vehicleDetail.notSelected')} onClick={() => { setQuickPickupCity(displayPickup?.city ?? 'Dubai'); setQuickEditor('pickup') }} />
              {displayPickup?.type === 'airport' && (
                <p className="flex items-center justify-end gap-1.5 text-xs font-medium text-brand-gold-dark">
                  <Plane className="h-3.5 w-3.5" aria-hidden="true" />
                  {displayPickup.airport_code
                    ? t('vehicleDetail.airportPickupWithCode', { code: displayPickup.airport_code })
                    : t('vehicleDetail.airportPickup')}
                </p>
              )}
              <EditableRow label={t('vehicleDetail.dropoff')} value={displayDropoff?.name ?? t('vehicleDetail.notSelected')} onClick={() => setQuickEditor('dropoff')} />
              <Row label={t('vehicleDetail.availability')} value={<AvailabilityBadge state={availability} />} />
            </div>

            {quickEditor && (
              <div className="mt-4 border-t border-brand-navy/10 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-brand-navy">{t('vehicleDetail.chooseTripDetails')}</p>
                  <button type="button" onClick={() => setQuickEditor(null)} className="text-xs font-medium text-text-muted underline-offset-2 hover:text-brand-navy hover:underline">{t('common.close')}</button>
                </div>
                <div className="mt-3">
                  {quickEditor === 'dates' && (
                    <DateRangePicker
                      startDate={quickCriteria.startDate ?? ''}
                      endDate={quickCriteria.endDate ?? ''}
                      onChange={(next) => updateQuickCriteria({ ...quickCriteria, ...next })}
                      todayIso={new Date().toISOString().slice(0, 10)}
                    />
                  )}
                  {quickEditor === 'pickup' && (
                    <div className="space-y-3">
                      <CitySelect
                        label={t('searchWidget.pickupCity')}
                        ariaLabel={t('searchWidget.pickupCity')}
                        value={quickPickupCity}
                        onChange={(city) => { setQuickPickupCity(city); setQuickCriteria({ ...quickCriteria, pickupLocationId: '', dropoffLocationId: quickCriteria.dropoffLocationId === quickCriteria.pickupLocationId ? '' : quickCriteria.dropoffLocationId }) }}
                        cities={Array.from(new Set(locations.map((location) => location.city))).sort()}
                      />
                      <LocationPickerButton
                        label={t('searchWidget.pickupLocation')}
                        locationId={quickCriteria.pickupLocationId ?? ''}
                        onLocationChange={(locationId) => updateQuickCriteria({ ...quickCriteria, pickupLocationId: locationId, dropoffLocationId: quickCriteria.dropoffLocationId || locationId })}
                        options={locations.filter((location) => location.country === 'United Arab Emirates' && location.city === quickPickupCity)}
                        loading={locations.length === 0}
                        placeholder={t('searchWidget.selectPickup')}
                        sheetTitle={t('searchWidget.choosePickupLocation')}
                      />
                    </div>
                  )}
                  {quickEditor === 'dropoff' && (
                    <LocationPickerButton
                      label={t('searchWidget.returnLocation')}
                      locationId={quickCriteria.dropoffLocationId ?? ''}
                      onLocationChange={(locationId) => updateQuickCriteria({ ...quickCriteria, dropoffLocationId: locationId })}
                      options={locations.filter((location) => location.country === 'United Arab Emirates')}
                      loading={locations.length === 0}
                      placeholder={t('searchWidget.selectReturnLocation')}
                      sheetTitle={t('searchWidget.chooseReturnLocation')}
                    />
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!hasDates || availability !== 'available'}
              onClick={() => {
                if (!id || !completeCriteria || !hasDates) return
                navigate(`/checkout/${id}/customer?${criteriaToSearchParams(completeCriteria).toString()}`)
              }}
              className="mt-5 w-full rounded-none bg-brand-gold px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-gold-light disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
            >
              {t('vehicleDetail.continueBooking')}
            </button>
            <p className="mt-2 text-center text-xs text-text-muted">
              {t('vehicleDetail.paymentNote')}
            </p>

            {/* Real, already-established site-wide policies — the exact
                same claims WhyChooseSection/DubaiOnlyBadge already make
                elsewhere, just surfaced again at the point of decision,
                never new copy invented for this page. */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-navy/10 pt-4">
              <DubaiOnlyBadge />
              <span className="inline-flex items-center gap-1.5 border border-brand-gold/50 bg-brand-gold/10 px-3 py-1 text-xs font-semibold text-brand-gold-dark">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                {t('vehicleDetail.selfDriveBadge')}
              </span>
              <span className="inline-flex items-center gap-1.5 border border-brand-gold/50 bg-brand-gold/10 px-3 py-1 text-xs font-semibold text-brand-gold-dark">
                <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
                {t('vehicleDetail.supportBadge')}
              </span>
            </div>
          </div>
        </section>
      </div>

      {similarVehicles && similarVehicles.length > 0 && (
        <section className="mt-12 border-t border-brand-navy/10 pt-10">
          <h2 className="font-hero-serif text-3xl font-semibold tracking-[-0.04em] text-brand-navy sm:text-4xl">
            {vehicle.vehicle_categories
              ? t('vehicleDetail.similarVehicles.title', { category: vehicle.vehicle_categories.name })
              : t('vehicleDetail.similarVehicles.titleGeneric')}
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {similarVehicles.map((similar) => (
              <VehicleCard
                key={similar.id}
                vehicle={similar}
                detailHref={`/vehicles/${similar.id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Spec({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className={'text-sm font-medium text-brand-navy ' + (capitalize ? 'capitalize' : '')}>{value}</dd>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-brand-navy">{value}</span>
    </div>
  )
}

function EditableRow({ label, value, onClick }: { label: string; value: ReactNode; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <button type="button" onClick={onClick} className="max-w-[65%] truncate text-end font-medium text-brand-navy underline decoration-brand-gold/60 underline-offset-4 hover:text-brand-navy-light focus:outline-none focus:ring-2 focus:ring-brand-gold">
        {value}
      </button>
    </div>
  )
}

function AvailabilityBadge({ state }: { state: 'checking' | 'available' | 'unavailable' | 'unknown' }) {
  const { t } = useTranslation()
  if (state === 'checking') return <span className="text-text-muted">{t('vehicleDetail.checking')}</span>
  if (state === 'available') return <span className="text-success">{t('vehicleDetail.available')}</span>
  if (state === 'unavailable') return <span className="text-error">{t('vehicleDetail.unavailable')}</span>
  return <span className="text-text-muted">{t('vehicleDetail.selectDates')}</span>
}
