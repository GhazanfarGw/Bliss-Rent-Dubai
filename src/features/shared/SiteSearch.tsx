import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarCheck,
  Car,
  ClipboardList,
  CornerDownLeft,
  LayoutGrid,
  MapPin,
  MessageCircle,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import { CITY_GUIDES } from '@/features/content/cityGuides'
import { BLOG_CATEGORIES, BLOG_POSTS, categoryCopy, postCopy, postPath } from '@/features/blog/blogPosts'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import { TERM_I18N_KEY } from '@/features/booking/VehicleCard'
import { CurrencySymbol } from '@/features/shared/ui/CurrencySymbol'
import { categoryLabel } from '@/lib/categoryName'
import { prefersReducedMotion } from '@/lib/motion'
import { groupPublicVehicles, type VehicleGroup } from '@/lib/vehicleGrouping'
import { sortCategoriesPremiumFirst } from '@/lib/vehicleFilters'
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
  { path: '/search?mode=book', titleKey: 'bookCar.title', descriptionKey: 'bookCar.subtitle', keywords: ['book', 'reserve', 'rent a car'] },
  { path: '/search', titleKey: 'nav.browseFleet', descriptionKey: 'nav.browseFleetDescription', keywords: ['fleet', 'cars', 'vehicles', 'browse'] },
  { path: '/car-types', titleKey: 'nav.carTypes', descriptionKey: 'nav.carTypesDescription', keywords: ['suv', 'luxury', 'economy', 'sedan', 'sports', 'supercar', 'categories'] },
  { path: '/locations', titleKey: 'nav.cities', descriptionKey: 'nav.citiesDescription', keywords: ['pickup', 'drop-off', 'airport', 'dubai', 'abu dhabi', 'cities'] },
  { path: '/manage-booking', titleKey: 'nav.manageBooking', descriptionKey: 'nav.manageBookingDescription', keywords: ['status', 'my car', 'days left', 'extend', 'payment', 'reservation', 'reference'] },
  { path: '/about', titleKey: 'nav.about', descriptionKey: 'nav.aboutDescription', keywords: ['company', 'story', 'mission', 'vision'] },
  { path: '/faqs', titleKey: 'pages.faqs.title', descriptionKey: 'pages.faqs.subtitle', keywords: ['faq', 'questions', 'help'] },
  { path: '/contact', titleKey: 'nav.contact', descriptionKey: 'nav.contactDescription', keywords: ['whatsapp', 'email', 'phone', 'office'] },
  { path: '/privacy-policy', titleKey: 'pages.privacyPolicy.title', keywords: ['privacy', 'data', 'legal'] },
  { path: '/cookie-policy', titleKey: 'pages.cookiePolicy.title', keywords: ['cookies', 'legal'] },
  { path: '/booking-terms', titleKey: 'pages.bookingTerms.title', keywords: ['terms', 'conditions', 'legal'] },
]

/**
 * The shortcuts offered before anything is typed — the pages a visitor most
 * often wants, each with an icon. Resolved against PAGE_INDEX so their
 * titles and descriptions are the translated strings the rest of the site
 * already uses.
 */
const QUICK_LINKS: { path: string; icon: LucideIcon }[] = [
  { path: '/search?mode=book', icon: CalendarCheck },
  { path: '/search', icon: Car },
  { path: '/car-types', icon: LayoutGrid },
  { path: '/locations', icon: MapPin },
  { path: '/manage-booking', icon: ClipboardList },
  { path: '/contact', icon: MessageCircle },
]

/** Keep the panel short — this is a quick jump-to-a-car shortcut, not a replacement for the full /search results grid. */
const MAX_VEHICLE_RESULTS = 5
const MAX_BLOG_RESULTS = 4

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

type PageKind = 'page' | 'city' | 'article'

interface PageResult {
  path: string
  title: string
  description?: string
  kind: PageKind
}

function matchPages(query: string, t: TFunction, language: string): PageResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  // Each city's own page (/locations/:slug) is searchable by its name in
  // the current language, its English name, or its slug.
  const cityEntries = CITY_GUIDES.map((guide) => {
    const copy = language === 'ar' ? guide.ar : guide.en
    return {
      path: `/locations/${guide.slug}`,
      title: copy.name,
      description: copy.tagline,
      keywords: [guide.city.toLowerCase(), guide.slug.replace(/-/g, ' ')],
      kind: 'city' as PageKind,
    }
  })
  const entries = [
    ...PAGE_INDEX.map((entry) => ({
      path: entry.path,
      title: t(entry.titleKey),
      description: entry.descriptionKey ? t(entry.descriptionKey) : undefined,
      keywords: entry.keywords,
      kind: 'page' as PageKind,
    })),
    ...cityEntries,
    // Blog articles — by headline, teaser, or their category/city name.
    ...BLOG_POSTS.map((post) => {
      const copy = postCopy(post, language)
      const category = BLOG_CATEGORIES.find((entry) => entry.id === post.category)
      return {
        path: postPath(post.slug),
        title: copy.title,
        description: copy.excerpt,
        keywords: [category ? categoryCopy(category, language).name.toLowerCase() : '', (post.city ?? '').replace(/-/g, ' ')].filter(Boolean),
        kind: 'article' as PageKind,
      }
    }),
  ]

  const hits = entries.filter(
    (entry) =>
      entry.title.toLowerCase().includes(q) ||
      (entry.description ?? '').toLowerCase().includes(q) ||
      entry.keywords.some((k) => k.includes(q)),
  )
  // Best match first — a title that starts with the query, then one that
  // merely contains it, then hits that only matched the description or an
  // alias. Array#sort is stable, so ties stay in reading order.
  const rank = (entry: { title: string }) => {
    const title = entry.title.toLowerCase()
    return title.startsWith(q) ? 0 : title.includes(q) ? 1 : 2
  }
  hits.sort((a, b) => rank(a) - rank(b))

  // A broad word ("dubai", "rental") matches most of the blog — keep it to
  // the few best and let the /blog page hold the rest.
  let articleHits = 0
  return hits.filter((entry) => entry.kind !== 'article' || ++articleHits <= MAX_BLOG_RESULTS)
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

/** The matched part of a result title, marked so the eye lands on why it matched. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase()
  const start = q ? text.toLowerCase().indexOf(q) : -1
  if (start === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-brand-champagne/30 text-inherit">{text.slice(start, start + q.length)}</mark>
      {text.slice(start + q.length)}
    </>
  )
}

/** Compact "From AED X/day" (or "Pricing coming soon") line — same headline-rate logic VehicleCard uses with no dates chosen, just laid out for a narrow result row. */
function VehiclePriceLine({ vehicle }: { vehicle: VehicleWithDetails }) {
  const { t } = useTranslation()
  const rate = cheapestHeadlineRate(vehicle.pricing)
  if (!rate) return <span className="text-xs font-medium text-text-muted">{t('vehicleCard.pricingSoon')}</span>
  return (
    <span className="text-xs font-semibold text-brand-navy">
      {t('vehicleCard.from')} <CurrencySymbol currency={rate.currency} /> {rate.client_price.toLocaleString()}
      <span className="ms-1 font-normal text-text-muted">{t(TERM_I18N_KEY[rate.term])}</span>
    </span>
  )
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <p className="px-5 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-gold-dark sm:px-6" aria-hidden="true">
      {children}
    </p>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center border border-brand-navy/15 bg-white px-1 font-sans text-[10px] font-semibold text-brand-navy/70">
      {children}
    </kbd>
  )
}

/**
 * Header site search. A "Search" button (an icon-only one on phones) opens
 * a large search palette in the middle of the screen over a dimmed, blurred
 * page — the pattern big travel sites use — instead of a small dropdown
 * hanging off the header icon.
 *
 * Before anything is typed it offers shortcuts: the key pages, the live
 * vehicle categories (each opens the fleet filtered to it) and the cities
 * served. Once you type it searches real cars (make / model / year /
 * category, from the same publicly-eligible fleet /search shows — see
 * groupPublicVehicles), the cities' guide pages, every public page and the
 * blog, grouped into labelled sections with the matching text highlighted.
 * ↑ ↓ move through the results, Enter opens one, Esc closes; Ctrl/⌘+K opens
 * it from anywhere. Selecting a result navigates there — this is a quick
 * jump-to shortcut, not a replacement for /search's full filter/sort grid.
 *
 * The palette is portalled to <body>: the header is a fixed, filtered
 * layer, and a `fixed` child inside it would be positioned against the
 * header rather than the screen.
 */
export function SiteSearch({ tone = 'dark', compact = false }: { tone?: 'light' | 'dark'; compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const reducedMotion = prefersReducedMotion()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [vehicles, setVehicles] = useState<VehicleWithDetails[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const vehiclesFetched = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const pageResults = useMemo(() => matchPages(query, t, i18n.language), [query, t, i18n.language])
  const vehicleGroups = useMemo(() => groupPublicVehicles(vehicles), [vehicles])
  const vehicleResults = useMemo(() => matchVehicles(vehicleGroups, query), [vehicleGroups, query])

  /**
   * Result sections in the order they're shown (cars first — what people
   * come to a rental site for — then cities, pages, articles). `offset` is
   * where a section's first row sits in the one flat sequence `activeIndex`
   * walks for keyboard navigation.
   */
  const sections = useMemo(() => {
    const ofKind = (kind: PageKind) => pageResults.filter((result) => result.kind === kind)
    const list: { key: string; heading: string; pages?: PageResult[]; cars?: VehicleGroup<VehicleWithDetails>[] }[] = []
    if (vehicleResults.length > 0) list.push({ key: 'cars', heading: t('nav.search.carsHeading'), cars: vehicleResults })
    for (const [key, kind, headingKey] of [
      ['cities', 'city', 'nav.search.citiesHeading'],
      ['pages', 'page', 'nav.search.pagesHeading'],
      ['articles', 'article', 'nav.search.articlesHeading'],
    ] as const) {
      const pages = ofKind(kind)
      if (pages.length > 0) list.push({ key, heading: t(headingKey), pages })
    }
    let offset = 0
    return list.map((section) => {
      const withOffset = { ...section, offset }
      offset += section.cars?.length ?? section.pages?.length ?? 0
      return withOffset
    })
  }, [vehicleResults, pageResults, t])

  const flatPaths = useMemo(
    () =>
      sections.flatMap((section) =>
        section.cars ? section.cars.map(({ vehicle }) => `/vehicles/${vehicle.id}`) : (section.pages ?? []).map((page) => page.path),
      ),
    [sections],
  )
  const resultCount = flatPaths.length

  const categoryChips = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; count: number }>()
    for (const { vehicle } of vehicleGroups) {
      const category = vehicle.vehicle_categories
      if (!category) continue
      const existing = byId.get(category.id)
      if (existing) existing.count += 1
      else byId.set(category.id, { id: category.id, name: category.name, count: 1 })
    }
    return sortCategoriesPremiumFirst(Array.from(byId.values()))
  }, [vehicleGroups])

  useEffect(() => setActiveIndex(0), [query, resultCount])

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

  function closeSearch() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  // Ctrl/⌘+K opens it from anywhere. NavBar renders two instances (desktop
  // and mobile, one of them `display: none`), so only the one whose button
  // is actually visible answers — otherwise both would open at once.
  useEffect(() => {
    function handleShortcut(e: globalThis.KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return
      if (!triggerRef.current || triggerRef.current.offsetParent === null) return
      e.preventDefault()
      setOpen(true)
    }
    document.addEventListener('keydown', handleShortcut)
    return () => document.removeEventListener('keydown', handleShortcut)
  }, [])

  // While the palette is open: focus the field, lock the page behind it
  // (padding the scrollbar's width so nothing jumps), and handle Escape,
  // an outside press, and a Tab that stays inside the panel.
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()

    const body = document.body
    const previousOverflow = body.style.overflow
    const previousPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`

    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (e.key !== 'Tab') return
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (!nodes || nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    function handleOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', handleKey, true)
    document.addEventListener('mousedown', handleOutside)
    return () => {
      document.removeEventListener('keydown', handleKey, true)
      document.removeEventListener('mousedown', handleOutside)
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPaddingRight
    }
  }, [open])

  function goTo(path: string) {
    setOpen(false)
    setQuery('')
    navigate(path)
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
      const target = flatPaths[activeIndex]
      if (target) goTo(target)
    }
  }

  // Keep the keyboard-highlighted row on screen as it moves through a long list.
  useEffect(() => {
    if (!open) return
    const row = panelRef.current?.querySelector<HTMLElement>(`[data-result-index="${activeIndex}"]`)
    if (typeof row?.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open, resultCount])

  const trimmed = query.trim()
  const showCarsLoading = trimmed.length > 0 && vehiclesLoading && vehicleResults.length === 0
  const noResults = trimmed.length > 0 && resultCount === 0 && !showCarsLoading

  // Over the homepage hero (transparent header) the button stays transparent,
  // like the other nav items on that header; on the solid white header it's
  // a quiet bordered one. Phones get a plain icon, like the other header icons.
  const triggerClass = compact
    ? 'h-10 w-10 justify-center ' + (tone === 'light' ? 'text-white hover:bg-white/10' : 'text-brand-gold hover:bg-brand-gold/10')
    : 'h-10 gap-2.5 border px-4 ' +
      (tone === 'light'
        ? 'border-white/40 bg-transparent text-white hover:border-white hover:bg-white/10'
        : 'border-brand-navy/15 bg-white text-brand-navy hover:border-brand-gold hover:text-brand-gold')

  const optionClass = (index: number) =>
    'flex w-full items-center gap-4 px-5 py-3 text-start transition-colors sm:px-6 ' +
    (index === activeIndex ? 'bg-surface-warm shadow-[inset_3px_0_0_0_var(--color-brand-gold)] rtl:shadow-[inset_-3px_0_0_0_var(--color-brand-gold)]' : 'hover:bg-surface-warm')

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('nav.search.ariaLabel')}
        className={'inline-flex items-center rounded-none transition-colors ' + triggerClass}
      >
        <Search className={compact ? 'h-5 w-5' : 'h-4.5 w-4.5'} aria-hidden="true" />
        {!compact && <span className="text-sm font-semibold">{t('nav.search.ariaLabel')}</span>}
        {!compact && (
          <kbd className="hidden border border-current/20 px-1.5 py-0.5 font-sans text-[10px] font-semibold opacity-60 xl:inline" aria-hidden="true">
            Ctrl K
          </kbd>
        )}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60]">
            <div className={'absolute inset-0 bg-[#05070d]/70 backdrop-blur-sm ' + (reducedMotion ? '' : 'animate-site-search-backdrop')} aria-hidden="true" />
            {/* The wrapper ignores pointer events so a press beside the panel
                falls through to the outside-press handler; only the panel
                takes them. */}
            <div className="pointer-events-none relative flex h-full items-start justify-center px-3 pt-3 sm:px-6 sm:pt-[12vh]">
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={t('nav.search.ariaLabel')}
                className={
                  'pointer-events-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden bg-white text-start shadow-[0_40px_120px_rgba(5,7,13,0.55)] sm:max-h-[76vh] ' +
                  (reducedMotion ? '' : 'animate-site-search-panel')
                }
              >
                <div className="h-1 shrink-0 bg-gradient-to-r from-brand-gold via-brand-champagne to-brand-gold" aria-hidden="true" />

                <div className="flex shrink-0 items-center gap-3 border-b border-brand-navy/10 px-4 sm:gap-4 sm:px-6">
                  <Search className="h-6 w-6 shrink-0 text-brand-gold" aria-hidden="true" />
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    spellCheck={false}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder={t('nav.search.placeholder')}
                    aria-label={t('nav.search.placeholder')}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={trimmed.length > 0}
                    aria-controls="site-search-results"
                    aria-activedescendant={resultCount > 0 ? `site-search-option-${activeIndex}` : undefined}
                    className="h-16 min-w-0 flex-1 bg-transparent text-lg text-brand-navy outline-none placeholder:text-brand-navy/40 sm:h-20 sm:text-xl"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('')
                        inputRef.current?.focus()
                      }}
                      aria-label={t('nav.search.clear')}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navy/8 text-brand-navy/70 transition-colors hover:bg-brand-navy/15 hover:text-brand-navy"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeSearch}
                    aria-label={t('nav.search.close')}
                    className="inline-flex h-10 shrink-0 items-center gap-2 border border-brand-navy/15 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-brand-navy/70 transition-colors hover:border-brand-gold hover:text-brand-gold"
                  >
                    <span className="hidden sm:inline" aria-hidden="true">
                      Esc
                    </span>
                    <X className="h-4 w-4 sm:hidden" aria-hidden="true" />
                  </button>
                </div>

                <div id="site-search-results" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
                  {!trimmed && (
                    <div>
                      <SectionHeading>{t('nav.search.quickLinksHeading')}</SectionHeading>
                      {/* grid-cols-1 (a minmax(0, 1fr) track) plus min-w-0 on the
                          items: without them a long, truncated description
                          sets the column's minimum width and the row spills
                          past the panel instead of ending in an ellipsis. */}
                      <ul className="grid grid-cols-1 gap-px border-y border-brand-navy/10 bg-brand-navy/10 sm:grid-cols-2 lg:grid-cols-3">
                        {QUICK_LINKS.map(({ path, icon: Icon }) => {
                          const entry = PAGE_INDEX.find((page) => page.path === path)
                          if (!entry) return null
                          return (
                            <li key={path} className="min-w-0 bg-white">
                              <button
                                type="button"
                                onClick={() => goTo(path)}
                                className="group flex w-full items-center gap-3.5 px-5 py-3.5 text-start transition-colors hover:bg-surface-warm sm:px-6"
                              >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-brand-gold/25 text-brand-gold transition-colors group-hover:border-brand-gold group-hover:bg-brand-gold group-hover:text-white">
                                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-brand-navy">{t(entry.titleKey)}</span>
                                  {entry.descriptionKey && <span className="mt-0.5 block truncate text-xs text-text-muted">{t(entry.descriptionKey)}</span>}
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>

                      {categoryChips.length > 0 && (
                        <>
                          <SectionHeading>{t('nav.search.categoriesHeading')}</SectionHeading>
                          <ul className="flex flex-wrap gap-2 px-5 sm:px-6">
                            {categoryChips.map((category) => (
                              <li key={category.id}>
                                <button
                                  type="button"
                                  onClick={() => goTo(`/search?category=${category.id}`)}
                                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-navy/15 bg-white px-4 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-gold hover:bg-brand-gold hover:text-white"
                                >
                                  {categoryLabel(t, category.name)}
                                  <span className="text-xs font-medium opacity-60">{category.count}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      <SectionHeading>{t('nav.search.citiesHeading')}</SectionHeading>
                      <ul className="flex flex-wrap gap-2 px-5 pb-1 sm:px-6">
                        {CITY_GUIDES.map((guide) => (
                          <li key={guide.slug}>
                            <button
                              type="button"
                              onClick={() => goTo(`/locations/${guide.slug}`)}
                              className="inline-flex min-h-9 items-center gap-1.5 border border-brand-navy/10 bg-surface-warm px-3 text-sm text-brand-navy transition-colors hover:border-brand-gold hover:text-brand-gold-dark"
                            >
                              <MapPin className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                              {(i18n.language === 'ar' ? guide.ar : guide.en).name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {trimmed && noResults && (
                    <div className="px-6 py-12 text-center">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center border border-brand-gold/25 text-brand-gold">
                        <Search className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <p className="mt-4 text-base font-semibold text-brand-navy">{t('nav.search.noResultsTitle')}</p>
                      <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">{t('nav.search.noResultsBody')}</p>
                      <button
                        type="button"
                        onClick={() => goTo('/search')}
                        className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-gold-dark"
                      >
                        {t('nav.search.browseFleet')}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  {trimmed && !noResults && (
                    <div>
                      {sections.map((section) => (
                        <div key={section.key}>
                          <SectionHeading>{section.heading}</SectionHeading>
                          <ul role="listbox" aria-label={section.heading}>
                            {section.cars?.map(({ vehicle, quantity }, i) => {
                              const index = section.offset + i
                              const image = primaryImage(vehicle)
                              return (
                                <li key={vehicle.id} id={`site-search-option-${index}`} role="option" aria-selected={index === activeIndex} data-result-index={index}>
                                  <button
                                    type="button"
                                    onClick={() => goTo(`/vehicles/${vehicle.id}`)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={optionClass(index)}
                                  >
                                    <VehiclePhoto
                                      storagePath={image?.storage_path ?? null}
                                      alt={`${vehicle.make} ${vehicle.model}`}
                                      className="h-14 w-20 shrink-0 rounded-none object-cover"
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-base font-semibold text-brand-navy">
                                        <Highlight text={`${vehicle.make} ${vehicle.model}`} query={query} />
                                      </span>
                                      <span className="block text-xs text-text-muted">
                                        {vehicle.model_year}
                                        {vehicle.vehicle_categories && ' · ' + categoryLabel(t, vehicle.vehicle_categories.name)}
                                        {quantity > 1 && ' · ' + t('vehicleCard.quantityAvailable', { count: quantity })}
                                      </span>
                                      <VehiclePriceLine vehicle={vehicle} />
                                    </span>
                                    <ArrowRight className="h-4 w-4 shrink-0 text-brand-gold opacity-60 rtl:rotate-180" aria-hidden="true" />
                                  </button>
                                </li>
                              )
                            })}
                            {section.pages?.map((result, i) => {
                              const index = section.offset + i
                              return (
                                <li key={result.path} id={`site-search-option-${index}`} role="option" aria-selected={index === activeIndex} data-result-index={index}>
                                  <button
                                    type="button"
                                    onClick={() => goTo(result.path)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={optionClass(index)}
                                  >
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-semibold text-brand-navy sm:text-base">
                                        <Highlight text={result.title} query={query} />
                                      </span>
                                      {result.description && <span className="mt-0.5 block truncate text-xs text-text-muted sm:text-sm">{result.description}</span>}
                                    </span>
                                    <ArrowRight className="h-4 w-4 shrink-0 text-brand-gold opacity-60 rtl:rotate-180" aria-hidden="true" />
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ))}

                      {showCarsLoading && (
                        <div>
                          <SectionHeading>{t('nav.search.carsHeading')}</SectionHeading>
                          <p className="px-5 py-3 text-sm text-text-muted sm:px-6">{t('nav.search.searchingCars')}</p>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                <div className="hidden shrink-0 items-center gap-5 border-t border-brand-navy/10 bg-surface-warm px-6 py-3 text-xs text-text-muted sm:flex" aria-hidden="true">
                  <span className="inline-flex items-center gap-1.5">
                    <Kbd>
                      <ArrowUp className="h-3 w-3" />
                    </Kbd>
                    <Kbd>
                      <ArrowDown className="h-3 w-3" />
                    </Kbd>
                    {t('nav.search.hintNavigate')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Kbd>
                      <CornerDownLeft className="h-3 w-3" />
                    </Kbd>
                    {t('nav.search.hintOpen')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Kbd>Esc</Kbd>
                    {t('nav.search.hintClose')}
                  </span>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
