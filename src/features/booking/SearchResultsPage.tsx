import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SearchWidget } from '@/features/booking/SearchWidget'
import { FilterBar } from '@/features/booking/FilterBar'
import { VehicleCard } from '@/features/booking/VehicleCard'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import { searchVehiclesWithAvailability, fetchAllAvailableVehicles, fetchLocations, BookingApiError } from '@/features/booking/api'
import { criteriaToSearchParams, isCompleteCriteria, searchParamsToCriteria } from '@/features/booking/searchParams'
import { validateDateRange, rentalDays } from '@/lib/dateRange'
import { applyFilters, distinctBrands, distinctCategories, distinctTransmissions, sortByPrice } from '@/lib/vehicleFilters'
import { groupPublicVehicles } from '@/lib/vehicleGrouping'
import { EMPTY_FILTERS } from '@/types/domain'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import type { Location, SearchCriteria, SortOption, VehicleFilters, VehicleSearchResult } from '@/types/domain'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; vehicles: VehicleSearchResult[] }

export function SearchResultsPage() {
  const { t, i18n } = useTranslation()
  useDocumentTitle(t('searchResults.title'))
  useMetaDescription('Browse available cars for rent in Dubai — filter by category and dates to find the right vehicle, with transparent pricing and fast airport pickup.')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const criteria = searchParamsToCriteria(searchParams)
  const complete = isCompleteCriteria(criteria)
  const dateValidation = complete
    ? validateDateRange(criteria.startDate, criteria.endDate)
    : { valid: false, error: null }

  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [filters, setFilters] = useState<VehicleFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortOption>('price_asc')
  const [locations, setLocations] = useState<Location[]>([])
  const [editingSearch, setEditingSearch] = useState(!complete)
  // A deep-link from e.g. CarTypesPage ("/search?category=<id>") should
  // pre-select that category filter on first load only — captured once in
  // a ref (read directly, not via state) so the very next effect run
  // below can consume-and-clear it without re-reading the URL, and so it
  // never re-applies itself after the customer changes filters/dates.
  const initialCategoryId = useRef(searchParams.get('category'))

  useEffect(() => {
    fetchLocations().then(setLocations).catch(() => setLocations([]))
  }, [])

  useEffect(() => setEditingSearch(!complete), [complete])

  useEffect(() => {
    if (initialCategoryId.current) {
      setFilters({ ...EMPTY_FILTERS, categoryId: initialCategoryId.current })
      initialCategoryId.current = null
    } else {
      setFilters(EMPTY_FILTERS)
    }

    // Dates were entered but don't form a valid range (e.g. drop-off before
    // pickup) — that's a real validation error, not "no dates yet". Show
    // the error message instead of fetching anything.
    if (complete && !dateValidation.valid) {
      setState({ status: 'idle' })
      return
    }

    let cancelled = false
    setState({ status: 'loading' })
    // With a complete, valid date range: check real availability for those
    // dates — every vehicle comes back, tagged available/reserved for that
    // range. Otherwise (customer hasn't chosen dates/locations yet): let
    // them browse the whole fleet first, same as the homepage's Featured
    // Vehicles (just without the 6-car cap); nothing can be "reserved"
    // without a date range to check against, so every result is tagged
    // available.
    const request = complete
      ? searchVehiclesWithAvailability(criteria.startDate!, criteria.endDate!)
      : fetchAllAvailableVehicles().then((vehicles) => vehicles.map((v) => ({ ...v, isAvailable: true })))
    request
      .then((vehicles) => {
        if (cancelled) return
        setState({ status: 'loaded', vehicles })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof BookingApiError || err instanceof Error
            ? err.message
            : 'Something went wrong while searching. Please try again.'
        setState({ status: 'error', message })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria.startDate, criteria.endDate, complete, dateValidation.valid])

  const hasDates = complete && dateValidation.valid
  const days = hasDates ? rentalDays(criteria.startDate!, criteria.endDate!) : 1

  const filteredSorted = useMemo(() => {
    if (state.status !== 'loaded') return []
    const filtered = applyFilters(state.vehicles, filters)
    return sortByPrice(filtered, sort, days)
  }, [state, filters, sort, days])

  // Task 1 — collapse same Make + Model + Year master listings into one
  // card with a combined quantity; listings missing a valid price/image
  // never render at all (see groupPublicVehicles). Grouped AFTER
  // filter/sort so the sidebar filters and price sort keep working on
  // the full, ungrouped fleet exactly as before.
  const groupedVehicles = useMemo(() => groupPublicVehicles(filteredSorted), [filteredSorted])

  function handleSearch(next: SearchCriteria) {
    navigate({ pathname: '/search', search: criteriaToSearchParams(next).toString() })
  }

  const locationName = (id?: string) => locations.find((location) => location.id === id)?.name ?? t('vehicleDetail.notSelected')
  const dateLabel = hasDates
    ? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(new Date(`${criteria.startDate}T00:00:00`)) +
      ' – ' + new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${criteria.endDate}T00:00:00`))
    : t('vehicleDetail.notSelected')

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden bg-brand-gold px-5 py-7 text-white shadow-[0_30px_80px_rgba(13,16,19,0.38)] sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white">{t('common.dubaiOnly')}</p>
            <h1 className="font-hero-serif mt-2 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{t('searchResults.heroTitle')}</h1>
          </div>
          {complete && <button type="button" onClick={() => setEditingSearch((current) => !current)} aria-expanded={editingSearch} className="inline-flex min-h-11 items-center border border-brand-gold-light/40 bg-white/5 px-4 text-sm font-semibold text-white transition-all duration-200 hover:border-brand-gold-light hover:bg-brand-gold-light/10 focus:outline-none focus:ring-2 focus:ring-brand-gold">{t('searchResults.editSearch')}</button>}
        </div>
        {complete && (
          <div className="mt-7 grid gap-3 text-sm sm:grid-cols-3">
            <SummaryItem label={t('searchResults.pickup')} value={locationName(criteria.pickupLocationId)} />
            <SummaryItem label={t('searchResults.dropoff')} value={locationName(criteria.dropoffLocationId)} />
            <SummaryItem label={t('searchResults.dates')} value={dateLabel} detail={`${days} ${t(days === 1 ? 'common.day' : 'common.days')}`} />
          </div>
        )}
      </section>

      {editingSearch && <div className="mt-4"><SearchWidget compact layout="row" initialValues={complete ? criteria : undefined} onSearch={handleSearch} /></div>}

      <div className="mt-6">
        {!hasDates && state.status === 'loaded' && (
          <p className="mb-4 text-sm text-text-muted">{t('searchResults.browsingAllHint')}</p>
        )}

        {complete && !dateValidation.valid && (
          <StateMessage
            tone="error"
            title={t('searchResults.invalidSearchTitle')}
            body={dateValidation.error ? t('errors.dateRange.' + dateValidation.error) : undefined}
          />
        )}

        {state.status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner className="h-8 w-8" />
            <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
          </div>
        )}

        {state.status === 'error' && (
          <StateMessage
            tone="error"
            title={t('searchResults.errorTitle')}
            body={state.message}
          />
        )}

        {state.status === 'loaded' && state.vehicles.length === 0 && (
          <StateMessage
            title={t('searchResults.noVehiclesTitle')}
            body={t('searchResults.noVehiclesBody')}
          />
        )}

        {state.status === 'loaded' && state.vehicles.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-brand-gold/20 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold-dark">{t('searchResults.resultsEyebrow')}</p>
                <h2 className="font-hero-serif mt-1 text-3xl font-semibold tracking-[-0.04em] text-brand-navy sm:text-4xl">{t('searchResults.title')}</h2>
              </div>
              <p className="text-sm font-medium text-text-muted" aria-live="polite">{t('searchResults.resultsCount', { count: groupedVehicles.length })}</p>
            </div>
            <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-8">
              <FilterBar categories={distinctCategories(state.vehicles)} brands={distinctBrands(state.vehicles)} transmissions={distinctTransmissions(state.vehicles)} filters={filters} sort={sort} resultCount={groupedVehicles.length} onFiltersChange={setFilters} onSortChange={setSort} showAvailabilityFilter={hasDates} />
              <div className="mt-5 lg:mt-0">
                {groupedVehicles.length === 0 ? (
                  <StateMessage title={t('searchResults.noVehiclesTitle')} body={t('searchResults.filterZeroBody')} action={<button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="min-h-11 rounded-none bg-brand-gold px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(92,9,49,0.2)]">{t('searchResults.filters.clear')}</button>} />
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {groupedVehicles.map(({ vehicle, quantity }) => <VehicleCard key={vehicle.id} vehicle={vehicle} days={hasDates ? days : undefined} detailHref={`/vehicles/${vehicle.id}?${searchParams.toString()}`} isAvailable={vehicle.isAvailable} quantity={quantity} />)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryItem({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-none border border-brand-gold/25 bg-white/6 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-brand-gold-light/80">{label}</p>
      <p className="mt-2 truncate font-semibold text-white">{value}</p>
      {detail && <p className="mt-1 text-xs text-white/70">{detail}</p>}
    </div>
  )
}
