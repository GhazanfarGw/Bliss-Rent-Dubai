import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Search, X } from 'lucide-react'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import { TERM_I18N_KEY } from '@/features/booking/VehicleCard'
import { groupPublicVehicles, type VehicleGroup } from '@/lib/vehicleGrouping'
import { primaryImage } from '@/lib/vehicleImages'
import { cheapestHeadlineRate } from '@/lib/pricing'
import type { VehicleWithDetails } from '@/types/domain'

interface PageEntry {
  path: string
  titleKey: string
  descriptionKey?: string
  /** Plain-English aliases so a query like "extend" or "airport" still
   *  finds the right page even when it doesn't appear in the (possibly
   *  Arabic) title/description being matched against. */
  keywords: string[]
}

/**
 * Every real, public customer-facing route (see App.tsx's `<Layout />`
 * group) — admin routes are deliberately excluded, this is a guest-facing
 * site search, not an internal tool finder. Titles/descriptions are
 * translation keys, resolved at match-time, so results are always in the
 * current language and never drift from the strings already shown
 * elsewhere in the app.
 */
const PAGE_INDEX: PageEntry[] = [
  { path: '/', titleKey: 'nav.home', descriptionKey: 'nav.homeDescription', keywords: ['home', 'homepage'] },
  { path: '/book', titleKey: 'bookCar.title', descriptionKey: 'bookCar.subtitle', keywords: ['book', 'reserve', 'rent a car'] },
  { path: '/search', titleKey: 'nav.browseFleet', descriptionKey: 'nav.browseFleetDescription', keywords: ['fleet', 'cars', 'vehicles', 'browse'] },
  { path: '/car-types', titleKey: 'nav.carTypes', descriptionKey: 'nav.carTypesDescription', keywords: ['suv', 'luxury', 'economy', 'sedan', 'categories'] },
  { path: '/locations', titleKey: 'nav.cities', descriptionKey: 'nav.citiesDescription', keywords: ['pickup', 'drop-off', 'airport', 'dubai', 'abu dhabi', 'cities'] },
  { path: '/find-my-car', titleKey: 'nav.findMyCar', descriptionKey: 'nav.findMyCarDescription', keywords: ['status', 'my car', 'days left'] },
  { path: '/manage-booking', titleKey: 'nav.manageBooking', descriptionKey: 'nav.manageBookingDescription', keywords: ['extend', 'payment', 'reservation', 'reference'] },
  { path: '/about', titleKey: 'nav.about', descriptionKey: 'nav.aboutDescription', keywords: ['company', 'story', 'mission', 'vision'] },
  { path: '/faqs', titleKey: 'pages.faqs.title', descriptionKey: 'pages.faqs.subtitle', keywords: ['faq', 'questions', 'help'] },
  { path: '/contact', titleKey: 'nav.contact', descriptionKey: 'nav.contactDescription', keywords: ['whatsapp', 'email', 'phone', 'office'] },
  { path: '/privacy-policy', titleKey: 'pages.privacyPolicy.title', keywords: ['privacy', 'data', 'legal'] },
  { path: '/cookie-policy', titleKey: 'pages.cookiePolicy.title', keywords: ['cookies', 'legal'] },
  { path: '/booking-terms', titleKey: 'pages.bookingTerms.title', keywords: ['terms', 'conditions', 'legal'] },
]

/** Keep the panel short — this is a quick jump-to-a-car shortcut, not a replacement for the full /search results grid. */
const MAX_VEHICLE_RESULTS = 5

interface PageResult {
  path: string
  title: string
  description?: string
}

function matchPages(query: string, t: TFunction): PageResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return PAGE_INDEX.map((entry) => ({
    path: entry.path,
    title: t(entry.titleKey),
    description: entry.descriptionKey ? t(entry.descriptionKey) : undefined,
    keywords: entry.keywords,
  })).filter(
    (entry) =>
      entry.title.toLowerCase().includes(q) ||
      (entry.description ?? '').toLowerCase().includes(q) ||
      entry.keywords.some((k) => k.includes(q)),
  )
}

/** Matches by make, model, model year, and category name (e.g. "SUV", "Luxury") — the same identifying fields a customer would actually type. */
function matchVehicles(groups: VehicleGroup<VehicleWithDetails>[], query: string): VehicleGroup<VehicleWithDetails>[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return groups
    .filter(({ vehicle }) => {
      const haystack = `${vehicle.make} ${vehicle.model} ${vehicle.model_year} ${vehicle.vehicle_categories?.name ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
    .slice(0, MAX_VEHICLE_RESULTS)
}

/** Compact "From AED X/day" (or "Pricing coming soon") line — same headline-rate logic VehicleCard uses with no dates chosen, just laid out for a narrow dropdown row. */
function VehiclePriceLine({ vehicle }: { vehicle: VehicleWithDetails }) {
  const { t } = useTranslation()
  const rate = cheapestHeadlineRate(vehicle.pricing)
  if (!rate) return <span className="text-xs font-medium text-text-muted">{t('vehicleCard.pricingSoon')}</span>
  return (
    <span className="text-xs font-semibold text-brand-navy">
      {t('vehicleCard.from')} {rate.currency} {rate.client_price.toLocaleString()}
      <span className="ms-1 font-normal text-text-muted">{t(TERM_I18N_KEY[rate.term])}</span>
    </span>
  )
}

/**
 * Header site search — a compact icon trigger (matches
 * PendingBookingIndicator's button styling) that opens a small panel with
 * a text field. Two result sections: real pages (title/description/
 * keyword match against every public route) and real cars (the same
 * publicly-eligible fleet /search shows — see groupPublicVehicles —
 * matched by make/model/year/category). Selecting a page result navigates
 * there; selecting a car result opens its detail page, same as clicking a
 * VehicleCard. This is a quick jump-to shortcut, not a replacement for
 * /search's full filter/sort grid.
 */
export function SiteSearch({ tone = 'dark' }: { tone?: 'light' | 'dark' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [vehicles, setVehicles] = useState<VehicleWithDetails[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const vehiclesFetched = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const pageResults = useMemo(() => matchPages(query, t), [query, t])
  const vehicleGroups = useMemo(() => groupPublicVehicles(vehicles), [vehicles])
  const vehicleResults = useMemo(() => matchVehicles(vehicleGroups, query), [vehicleGroups, query])
  const resultCount = pageResults.length + vehicleResults.length

  useEffect(() => setActiveIndex(0), [query, pageResults.length, vehicleResults.length])

  // Fleet data is fetched lazily on first open, not on every header render
  // — most visits never open this at all, so there's no point costing
  // every page load a Supabase round trip just in case.
  useEffect(() => {
    if (!open || vehiclesFetched.current) return
    vehiclesFetched.current = true
    setVehiclesLoading(true)
    fetchAllAvailableVehicles()
      .then(setVehicles)
      .catch(() => setVehicles([]))
      .finally(() => setVehiclesLoading(false))
  }, [open])

  useEffect(() => {
    setOpen(false)
    setQuery('')
  }, [location.pathname])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function goTo(path: string) {
    setOpen(false)
    setQuery('')
    navigate(path)
  }

  /** Pages come first, then cars — `activeIndex` walks the two lists as one sequence for keyboard nav. */
  function pathAt(index: number): string | null {
    if (index < pageResults.length) return pageResults[index]?.path ?? null
    const group = vehicleResults[index - pageResults.length]
    return group ? `/vehicles/${group.vehicle.id}` : null
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (resultCount) setActiveIndex((i) => (i + 1) % resultCount)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (resultCount) setActiveIndex((i) => (i - 1 + resultCount) % resultCount)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = pathAt(activeIndex)
      if (target) goTo(target)
    }
  }

  const showCarsLoading = query.trim().length > 0 && vehiclesLoading && vehicleResults.length === 0
  const noResults = query.trim().length > 0 && resultCount === 0 && !showCarsLoading
  const showSectionHeadings = pageResults.length > 0 && (vehicleResults.length > 0 || showCarsLoading)
  // Transparent, icon-only trigger — white over the homepage hero (before
  // scroll), the brand's active/accent gold once the header goes solid
  // (after scroll), same as an active nav link's color. No background box
  // at rest; only a soft tone-matched wash on hover.
  const triggerToneClass = tone === 'light' ? 'text-white hover:bg-white/10' : 'text-brand-gold hover:bg-brand-gold/10'

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('nav.search.ariaLabel')}
        className={'inline-flex h-10 w-10 items-center justify-center rounded-none bg-transparent transition-colors ' + triggerToneClass}
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
      </button>

      {open && (
        // Same viewport-anchored-on-mobile / button-anchored-on-desktop
        // pattern as PendingBookingIndicator's panel: below `lg` this
        // button can sit anywhere in a fairly narrow mobile header row, so
        // anchoring to the viewport (`fixed inset-x-4`) avoids a wide panel
        // overshooting the screen edge the way `absolute end-0` would.
        <div
          role="dialog"
          aria-label={t('nav.search.ariaLabel')}
          className="fixed inset-x-4 top-20 z-50 rounded-none border border-brand-navy/10 bg-white p-3 text-start shadow-[0_20px_38px_rgba(18,20,23,0.14)] lg:absolute lg:inset-x-auto lg:end-0 lg:top-12 lg:w-96 lg:max-w-[calc(100vw-2rem)]"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={t('nav.search.placeholder')}
              aria-label={t('nav.search.placeholder')}
              role="combobox"
              aria-expanded={query.trim().length > 0}
              aria-controls="site-search-results"
              className="w-full rounded-none border border-brand-navy/15 bg-white py-2.5 ps-9 pe-3 text-sm text-brand-navy outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/25"
            />
          </div>

          {query.trim() && (
            <div id="site-search-results" className="mt-2 max-h-96 overflow-y-auto">
              {noResults ? (
                <p className="px-2 py-4 text-center text-sm text-text-muted">
                  <span className="block font-medium text-brand-navy">{t('nav.search.noResultsTitle')}</span>
                  <span className="mt-1 block text-xs">{t('nav.search.noResultsBody')}</span>
                </p>
              ) : (
                <>
                  {pageResults.length > 0 && (
                    <ul role="listbox" aria-label={t('nav.search.pagesHeading')}>
                      {showSectionHeadings && (
                        <li className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold-dark" aria-hidden="true">
                          {t('nav.search.pagesHeading')}
                        </li>
                      )}
                      {pageResults.map((result, i) => (
                        <li key={result.path} role="option" aria-selected={i === activeIndex}>
                          <button
                            type="button"
                            onClick={() => goTo(result.path)}
                            onMouseEnter={() => setActiveIndex(i)}
                            className={'block w-full px-3 py-2.5 text-start transition-colors ' + (i === activeIndex ? 'bg-surface-warm' : 'hover:bg-surface-warm')}
                          >
                            <span className="block text-sm font-semibold text-brand-navy">{result.title}</span>
                            {result.description && <span className="mt-0.5 block truncate text-xs text-text-muted">{result.description}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {(vehicleResults.length > 0 || showCarsLoading) && (
                    <ul role="listbox" aria-label={t('nav.search.carsHeading')} className={pageResults.length > 0 ? 'mt-1 border-t border-brand-navy/10 pt-1' : undefined}>
                      {showSectionHeadings && (
                        <li className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold-dark" aria-hidden="true">
                          {t('nav.search.carsHeading')}
                        </li>
                      )}
                      {showCarsLoading ? (
                        <li className="px-3 py-3 text-sm text-text-muted">{t('nav.search.searchingCars')}</li>
                      ) : (
                        vehicleResults.map(({ vehicle, quantity }, i) => {
                          const overallIndex = pageResults.length + i
                          const image = primaryImage(vehicle)
                          return (
                            <li key={vehicle.id} role="option" aria-selected={overallIndex === activeIndex}>
                              <button
                                type="button"
                                onClick={() => goTo(`/vehicles/${vehicle.id}`)}
                                onMouseEnter={() => setActiveIndex(overallIndex)}
                                className={'flex w-full items-center gap-3 px-3 py-2 text-start transition-colors ' + (overallIndex === activeIndex ? 'bg-surface-warm' : 'hover:bg-surface-warm')}
                              >
                                <VehiclePhoto
                                  storagePath={image?.storage_path ?? null}
                                  alt={`${vehicle.make} ${vehicle.model}`}
                                  className="h-12 w-16 shrink-0 rounded-none object-cover"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-brand-navy">
                                    {vehicle.make} {vehicle.model}
                                  </span>
                                  <span className="block text-xs text-text-muted">
                                    {vehicle.model_year}
                                    {quantity > 1 && ' · ' + t('vehicleCard.quantityAvailable', { count: quantity })}
                                  </span>
                                  <VehiclePriceLine vehicle={vehicle} />
                                </span>
                              </button>
                            </li>
                          )
                        })
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
