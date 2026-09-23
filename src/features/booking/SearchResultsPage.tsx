import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SearchWidget } from '@/features/booking/SearchWidget'
import { FilterRail, FilterToolbar, RailColumn, ResultsBar, SortField } from '@/features/booking/FilterBar'
import type { FacetCounts } from '@/features/booking/FilterPanel'
import { TripCard, TripPill, type TripView } from '@/features/booking/TripSummary'
import { VehicleCard } from '@/features/booking/VehicleCard'
import { Dialog } from '@/features/shared/ui/Dialog'
import { StateMessage } from '@/features/shared/StateMessage'
import { searchVehiclesWithAvailability, fetchAllAvailableVehicles, fetchLocations, BookingApiError } from '@/features/booking/api'
import { criteriaToSearchParams, isCompleteCriteria, searchParamsToCriteria } from '@/features/booking/searchParams'
import { validateDateRange, rentalDays } from '@/lib/dateRange'
import { formatTimeLabel } from '@/lib/timeOptions'
import {
  applyFilters,
  distinctBrands,
  distinctCategories,
  distinctSeats,
  distinctTransmissions,
  priceBounds,
  sortByPrice,
  sortCategoriesPremiumFirst,
  sortLuxuryFirst,
} from '@/lib/vehicleFilters'
import { groupPublicVehicles } from '@/lib/vehicleGrouping'
import { EMPTY_FILTERS } from '@/types/domain'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import type { Location, SearchCriteria, SortOption, VehicleFilters, VehicleSearchResult } from '@/types/domain'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; vehicles: VehicleSearchResult[] }

// Same width and gutters as the header, so the page lines up with it edge to edge.
const CONTAINER = 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'
const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3'
// The desktop layout: a sticky column (trip summary + filters) beside the results.
const WITH_RAIL = 'lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:items-start lg:gap-6 xl:gap-8'
const EMPTY_FACETS: FacetCounts = { category: {}, brand: {}, transmission: {}, seats: {} }

/**
 * The fleet catalogue — and, since the booking architecture simplification,
 * the site's single search/booking entry point (every global "Book Now" CTA
 * lands here, via `?mode=book`; see BookCarPage's /book redirect). Deliberately
 * light on chrome: a one-line title with the sort order beside it, then the
 * cars next to a sticky column that holds the customer's trip (where and when
 * — or a prompt to add dates) above the filters, so the trip never scrolls out
 * of sight. On phones the trip rides in the sticky chips-and-sheet toolbar
 * instead. The date/location form (the same SearchWidget used everywhere else
 * on the site) opens in a dialog when the customer asks to edit, or
 * automatically on arrival with `?mode=book` — never a second, separate form.
 */
export function SearchResultsPage() {
  const { t, i18n } = useTranslation()
  useDocumentTitle(t('searchResults.title'))
  useMetaDescription(
    'Browse available cars for rent in Dubai — filter by category and dates to find the right vehicle, with transparent pricing and fast airport pickup.',
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const criteria = searchParamsToCriteria(searchParams)
  const complete = isCompleteCriteria(criteria)
  const dateValidation = complete ? validateDateRange(criteria.startDate, criteria.endDate) : { valid: false, error: null }

  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [filters, setFilters] = useState<VehicleFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortOption>('price_asc')
  const [locations, setLocations] = useState<Location[]>([])
  // `?mode=book` is Fleet's one entry point for every global "Book Now"
  // CTA (see NavBar, Hero, ClosingCta, etc.) — it opens the same search
  // dialog a visitor would otherwise have to click "Add your dates"/"Edit
  // search" for, so a generic "start a booking" click lands straight on
  // the search form instead of the results grid. Read once at mount; the
  // effect below strips it from the URL right after so it doesn't linger
  // (e.g. reappearing on a browser-back visit after the dialog was closed).
  const [editingSearch, setEditingSearch] = useState(() => searchParams.get('mode') === 'book')
  const initialCategoryId = useRef(searchParams.get('category'))

  useEffect(() => {
    if (searchParams.get('mode') !== 'book') return
    const next = new URLSearchParams(searchParams)
    next.delete('mode')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchLocations().then(setLocations).catch(() => setLocations([]))
  }, [])

  useEffect(() => {
    if (initialCategoryId.current) {
      setFilters({ ...EMPTY_FILTERS, categoryId: initialCategoryId.current })
      initialCategoryId.current = null
    } else {
      setFilters(EMPTY_FILTERS)
    }

    if (complete && !dateValidation.valid) {
      setState({ status: 'idle' })
      return
    }

    let cancelled = false
    setState({ status: 'loading' })
    const request = complete
      ? searchVehiclesWithAvailability(criteria.startDate!, criteria.endDate!)
      : fetchAllAvailableVehicles().then((vehicles) => vehicles.map((vehicle) => ({ ...vehicle, isAvailable: true })))

    request
      .then((vehicles) => {
        if (!cancelled) setState({ status: 'loaded', vehicles })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message:
            err instanceof BookingApiError || err instanceof Error
              ? err.message
              : 'Something went wrong while searching. Please try again.',
        })
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria.startDate, criteria.endDate, complete, dateValidation.valid])

  const hasDates = complete && dateValidation.valid
  const days = hasDates ? rentalDays(criteria.startDate!, criteria.endDate!) : 1
  const loaded = state.status === 'loaded'

  const groupedVehicles = useMemo(() => {
    if (state.status !== 'loaded') return []
    return groupPublicVehicles(sortLuxuryFirst(sortByPrice(applyFilters(state.vehicles, filters), sort, days)))
  }, [state, filters, sort, days])

  // Every option shows how many cars it would list, so each count follows all
  // the active filters except the one it belongs to.
  const facets = useMemo(() => {
    if (state.status !== 'loaded') return { ...EMPTY_FACETS, total: 0 }
    const groupsWith = (reset: Partial<VehicleFilters>) => groupPublicVehicles(applyFilters(state.vehicles, { ...filters, ...reset }))
    const tally = <K extends string | number>(groups: ReturnType<typeof groupsWith>, keyOf: (vehicle: VehicleSearchResult) => K | null | undefined) => {
      const counts = {} as Record<K, number>
      for (const { vehicle } of groups) {
        const key = keyOf(vehicle)
        if (key != null) counts[key] = (counts[key] ?? 0) + 1
      }
      return counts
    }
    const byCategory = groupsWith({ categoryId: null })
    const bySeats = groupsWith({ minSeats: null })
    const seats: Record<number, number> = {}
    for (const value of distinctSeats(state.vehicles)) seats[value] = bySeats.filter(({ vehicle }) => vehicle.seats >= value).length
    return {
      category: tally(byCategory, (vehicle) => vehicle.category_id),
      brand: tally(groupsWith({ brands: [] }), (vehicle) => vehicle.make),
      transmission: tally(groupsWith({ transmission: null }), (vehicle) => vehicle.transmission),
      seats,
      total: byCategory.length,
    }
  }, [state, filters])

  const categories = useMemo(
    () => (state.status === 'loaded' ? sortCategoriesPremiumFirst(distinctCategories(state.vehicles)) : []),
    [state],
  )
  const brands = useMemo(() => (state.status === 'loaded' ? distinctBrands(state.vehicles) : []), [state])
  const transmissions = useMemo(
    () => (state.status === 'loaded' ? distinctTransmissions(state.vehicles) : []),
    [state],
  )
  const seatOptions = useMemo(() => (state.status === 'loaded' ? distinctSeats(state.vehicles) : []), [state])
  const bounds = useMemo(() => (state.status === 'loaded' ? priceBounds(state.vehicles) : null), [state])
  // Prices are stored with their currency; use the fleet's own rather than assuming one.
  const currency = state.status === 'loaded' ? (state.vehicles.find((v) => v.pricing.length > 0)?.pricing[0].currency ?? 'AED') : 'AED'

  const controls = {
    categories,
    brands,
    transmissions,
    seatOptions,
    priceBounds: bounds,
    currency,
    facets,
    totalCount: facets.total,
    showAvailabilityFilter: hasDates,
    filters,
    sort,
    onFiltersChange: setFilters,
    onSortChange: setSort,
  }

  function handleSearch(next: SearchCriteria) {
    setEditingSearch(false)
    navigate({ pathname: '/search', search: criteriaToSearchParams(next).toString() })
  }

  // Stable, so the dialog does not treat every render as a fresh `onClose`.
  const openEditor = useCallback(() => setEditingSearch(true), [])
  const closeEditor = useCallback(() => setEditingSearch(false), [])

  // Until the location list arrives the names are unknown, which is not the same as "not selected".
  const locationName = (id?: string) =>
    locations.find((location) => location.id === id)?.name ?? (locations.length > 0 ? t('vehicleDetail.notSelected') : '…')
  const formatDay = (iso: string | undefined, options: Intl.DateTimeFormatOptions) =>
    iso ? new Intl.DateTimeFormat(i18n.language, options).format(new Date(`${iso}T00:00:00`)) : ''
  const fullDay: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }

  const trip: TripView = {
    hasDates,
    rangeLabel: hasDates
      ? `${formatDay(criteria.startDate, { day: 'numeric', month: 'short' })} – ${formatDay(criteria.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : '',
    startLabel: hasDates ? formatDay(criteria.startDate, fullDay) : '',
    endLabel: hasDates ? formatDay(criteria.endDate, fullDay) : '',
    time: hasDates && criteria.pickupTime ? formatTimeLabel(criteria.pickupTime, i18n.language) : '',
    days,
    pickup: hasDates ? locationName(criteria.pickupLocationId) : '',
    dropoff: hasDates ? locationName(criteria.dropoffLocationId) : '',
    onEdit: openEditor,
  }
  const hasCars = loaded && state.vehicles.length > 0

  return (
    <div className="min-h-screen bg-[#f5f3ef] pb-12 sm:pb-16">
      <div className={CONTAINER + ' pt-6 sm:pt-8 lg:pt-10'}>
        <header className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
          <div>
            <h1 className="font-hero-serif text-2xl font-semibold leading-tight tracking-tight text-brand-navy sm:text-3xl">
              {t('searchResults.title')}
            </h1>
            <p className="mt-2 min-h-5 text-sm text-text-muted" aria-live="polite">
              {hasCars ? t('searchResults.resultsCount', { count: groupedVehicles.length }) : ''}
            </p>
          </div>

          <SortField sort={sort} onChange={setSort} disabled={!hasCars} />
        </header>

        {complete && !dateValidation.valid && (
          <div className="pb-5">
            <StateMessage
              tone="error"
              title={t('searchResults.invalidSearchTitle')}
              body={dateValidation.error ? t(`errors.dateRange.${dateValidation.error}`) : undefined}
            />
          </div>
        )}
      </div>

      {hasCars ? (
        <FilterToolbar {...controls} tripSlot={<TripPill trip={trip} />} />
      ) : (
        // No cars to filter, so no toolbar — but the trip still has to be visible and editable on phones.
        <div className={CONTAINER + ' pb-4 lg:hidden'}>
          <TripPill trip={trip} />
        </div>
      )}

      <section className={CONTAINER + ' pt-5 sm:pt-6 lg:pt-2'}>
        {/* Full width and above both columns, so the side column and the cars always start on the same line. */}
        {hasCars && <ResultsBar filters={filters} categories={categories} currency={currency} onFiltersChange={setFilters} />}

        <div className={WITH_RAIL}>
          <RailColumn>
            <TripCard trip={trip} />
            {hasCars && <FilterRail {...controls} />}
          </RailColumn>

          <div className="min-w-0">
            {state.status === 'loading' && <FleetSkeleton />}

            {state.status === 'error' && <StateMessage tone="error" title={t('searchResults.errorTitle')} body={state.message} />}

            {loaded && state.vehicles.length === 0 && (
              <StateMessage title={t('searchResults.noVehiclesTitle')} body={t('searchResults.noVehiclesBody')} />
            )}

            {hasCars &&
              (groupedVehicles.length === 0 ? (
                <StateMessage
                  title={t('searchResults.noVehiclesTitle')}
                  body={t('searchResults.filterZeroBody')}
                  action={
                    <button
                      type="button"
                      onClick={() => setFilters(EMPTY_FILTERS)}
                      className="min-h-11 bg-brand-gold px-5 text-sm font-semibold text-white transition-all hover:brightness-105"
                    >
                      {t('searchResults.filters.clear')}
                    </button>
                  }
                />
              ) : (
                <div className={GRID}>
                  {groupedVehicles.map(({ vehicle, quantity }) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      days={hasDates ? days : undefined}
                      detailHref={`/vehicles/${vehicle.id}?${searchParams.toString()}`}
                      isAvailable={vehicle.isAvailable}
                      quantity={quantity}
                    />
                  ))}
                </div>
              ))}
          </div>
        </div>
      </section>

      <Dialog
        open={editingSearch}
        onClose={closeEditor}
        title={t(hasDates ? 'searchResults.editSearch' : 'searchResults.addDates')}
        closeLabel={t('common.close')}
        mobileSheet
        maxWidthClassName="max-w-3xl"
      >
        <SearchWidget layout="card" chromeless initialValues={complete ? criteria : undefined} onSearch={handleSearch} />
      </Dialog>
    </div>
  )
}

function FleetSkeleton() {
  return (
    <div aria-label="Loading fleet" className={'animate-pulse ' + GRID}>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="overflow-hidden border border-brand-navy/8 bg-white">
          <div className="aspect-16/10 bg-brand-navy/8" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-24 bg-brand-navy/8" />
            <div className="h-6 w-3/5 bg-brand-navy/10" />
            <div className="h-3 w-2/5 bg-brand-navy/8" />
            <div className="h-11 bg-brand-navy/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
