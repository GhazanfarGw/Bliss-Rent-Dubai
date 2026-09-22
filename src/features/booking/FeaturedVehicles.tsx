import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import { VehicleCard } from '@/features/booking/VehicleCard'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { SectionHeader } from '@/features/shared/ui/SectionHeader'
import { StateMessage } from '@/features/shared/StateMessage'
import { categoryLabel } from '@/lib/categoryName'
import { cardStep } from '@/lib/scrollTrack'
import { distinctCategories, sortCategoriesPremiumFirst } from '@/lib/vehicleFilters'
import { groupPublicVehicles } from '@/lib/vehicleGrouping'
import type { VehicleWithDetails } from '@/types/domain'

/** Vehicles shown per category — the newest N (the fleet arrives newest-first). */
const FEATURED_PER_CATEGORY = 6

/**
 * How brisk the glide of an arrow press is (the spring stiffness, in radians
 * per second). The glide is critically damped: it starts from rest, speeds up
 * gently, and settles without overshooting — about half a second in all.
 */
const SLIDE_STIFFNESS = 14

/** The CSS marquee running on the row — absent when the visitor prefers reduced motion. */
function marqueeOf(track: HTMLElement | null): Animation | undefined {
  return track?.getAnimations?.()[0]
}

function marqueeDuration(marquee: Animation): number {
  return Number(marquee.effect?.getComputedTiming().duration) || 36000
}

/** `value` folded into [0, length) — the marquee's clock must never go negative. */
function wrap(value: number, length: number): number {
  return ((value % length) + length) % length
}

interface FeaturedVehiclesProps {
  /**
   * The homepage supplies its shared fleet request here so the featured row
   * and the sports carousel do not issue the same Supabase query twice.
   * Omit this prop when rendering the section on its own; it will load the
   * fleet exactly as it did before.
   */
  vehicles?: VehicleWithDetails[] | null
  failed?: boolean
}

/**
 * Homepage "Featured Vehicles" section: one row of real vehicles, with a
 * tab for every category that has cars available right now.
 *
 * The tabs are the LIVE categories (Luxury, Sports & Supercars, SUV,
 * Economy today), in the same premium-first order the search results use —
 * not a hardcoded pair. A category shows up here the moment it has an
 * available vehicle and disappears when it has none, and a category an admin
 * adds tomorrow needs no code change. One fleet fetch feeds every tab, so
 * switching is instant.
 *
 * The active category's cards auto-scroll — the vehicle list duplicated
 * so animating the row by exactly -50% loops seamlessly (each half holds the
 * list as many times as it takes to be wider than the window, so a short
 * category never leaves a blank stretch). Direction alternates by tab
 * position purely so switching tabs reads as a visibly different row.
 * Pausing on hover or focus is pure CSS (see index.css).
 *
 * The arrows before the tabs move that same running animation by exactly one
 * card, easing it there, so the row keeps drifting smoothly from wherever it
 * was put; they work on every category's row. "View all vehicles" sits under
 * the row.
 *
 * Real vehicles from the database only (no dates, so VehicleCard falls back
 * to its headline "From <rate>" price), or an honest empty state — never
 * invented cars, prices, or fleet counts.
 */
export function FeaturedVehicles({ vehicles: providedVehicles, failed: providedFailed = false }: FeaturedVehiclesProps = {}) {
  const { t } = useTranslation()
  const [loadedVehicles, setLoadedVehicles] = useState<VehicleWithDetails[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (providedVehicles !== undefined) return

    let cancelled = false
    fetchAllAvailableVehicles()
      .then((data) => {
        if (!cancelled) setLoadedVehicles(data)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [providedVehicles])

  const vehicles = providedVehicles === undefined ? loadedVehicles : providedVehicles
  const failed = providedVehicles === undefined ? loadFailed : providedFailed

  const tabs = useMemo(() => sortCategoriesPremiumFirst(distinctCategories(vehicles ?? [])), [vehicles])
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === selectedId))
  const activeTab = tabs[activeIndex]

  const loading = vehicles === null && !failed
  // Same Make + Model + Year master listings collapse into one featured
  // card with a combined quantity; see SearchResultsPage for the
  // identical rule applied to search results.
  const grouped = groupPublicVehicles(
    activeTab && vehicles ? vehicles.filter((v) => v.category_id === activeTab.id).slice(0, FEATURED_PER_CATEGORY) : [],
  )
  const total = grouped.length
  // Neighbouring tabs drift opposite ways; this is the animation's own sense of it.
  const goesLeft = activeIndex % 2 === 0

  const trackRef = useRef<HTMLDivElement>(null)
  const regionRef = useRef<HTMLDivElement>(null)
  const slideRef = useRef<{ frame: number; offset: number; velocity: number; goal: number } | null>(null)
  // How many times each half of the loop holds the list. One half must be at
  // least as wide as the window, or the row runs out of cars part-way round
  // and leaves a blank stretch on the right — which a category of only three
  // cars would do on a wide screen.
  const [repeats, setRepeats] = useState(1)

  useLayoutEffect(() => {
    const region = regionRef.current
    const track = trackRef.current
    if (!region || !track || total === 0) return
    const measure = () => {
      const step = cardStep(track)
      if (step > 0) setRepeats(Math.max(1, Math.ceil(region.clientWidth / (total * step))))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [total, activeTab?.id])

  // A slide in flight belongs to the row it started on.
  useEffect(
    () => () => {
      if (slideRef.current) cancelAnimationFrame(slideRef.current.frame)
      slideRef.current = null
    },
    [activeTab?.id],
  )

  /**
   * Moves the row one card: +1 brings later cards in from the edge, -1 brings
   * earlier ones back. The marquee keeps running the whole time — it is never
   * paused or restarted from here, so the stylesheet's hover / focus pause
   * stays in charge of it. Each frame just nudges the animation's clock
   * towards the new spot along a critically damped spring, on top of the drift
   * itself. Presses made mid-slide add to the goal and keep the momentum.
   */
  function slide(direction: 1 | -1) {
    const track = trackRef.current
    if (!track) return
    const step = cardStep(track)
    // +1 = the cards travel left on screen (mirrored in a right-to-left page).
    const travel = direction * (getComputedStyle(track).direction === 'rtl' ? -1 : 1)
    const marquee = marqueeOf(track)

    if (!marquee) {
      // Reduced motion: nothing drifts, so slide the still row by hand.
      track.parentElement?.scrollBy?.({ left: travel * step, behavior: 'smooth' })
      return
    }

    const half = track.scrollWidth / 2
    if (step <= 0 || half <= 0) return
    const duration = marqueeDuration(marquee)
    const delta = (goesLeft ? travel : -travel) * (step / half) * duration

    const inFlight = slideRef.current
    if (inFlight) {
      inFlight.goal += delta
      return
    }

    const pxPerMs = half / duration
    const state = { frame: 0, offset: 0, velocity: 0, goal: delta }
    slideRef.current = state
    let last = performance.now()
    const tick = (now: number) => {
      const seconds = Math.min(0.05, (now - last) / 1000)
      last = now
      const remaining = state.goal - state.offset
      // Within half a pixel of the goal and all but stopped: land exactly on it.
      const arrived = Math.abs(remaining) * pxPerMs < 0.5 && Math.abs(state.velocity) * pxPerMs < 5
      let move = remaining
      if (!arrived) {
        state.velocity += (SLIDE_STIFFNESS ** 2 * remaining - 2 * SLIDE_STIFFNESS * state.velocity) * seconds
        move = state.velocity * seconds
      }
      state.offset += move
      marquee.currentTime = wrap((Number(marquee.currentTime) || 0) + move, duration)
      if (arrived) slideRef.current = null
      else state.frame = requestAnimationFrame(tick)
    }
    state.frame = requestAnimationFrame(tick)
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
      <SectionHeader
        as="h2"
        eyebrow={t('home.featured.eyebrow')}
        title={t('home.featured.title')}
        description={t('home.featured.subtitle')}
        emphasis="marketing"
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* One pill per live category — plain buttons, not an extracted
            shared component (no Tabs primitive exists in
            src/features/shared/ui/, and this is a one-off). They wrap onto
            extra lines rather than scroll, so any number of categories works
            on a phone. aria-pressed marks the active one for screen readers. */}
        {tabs.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('home.featured.groupLabel')}>
            {tabs.map((tab) => {
              const active = tab.id === activeTab?.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(tab.id)}
                  className={
                    'min-h-11 rounded-full border px-5 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold sm:px-6 ' +
                    (active
                      ? 'border-brand-gold bg-brand-gold text-white shadow-md'
                      : 'border-brand-gold/20 bg-white text-brand-navy hover:bg-brand-lavender')
                  }
                >
                  {categoryLabel(t, tab.name)}
                </button>
              )
            })}
          </div>
        )}

        {/* Previous / next come after the category pills, pushed to the end
            of the row. They move whichever category's row is showing. */}
        {!loading && !failed && total > 0 && (
          <div className="ms-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => slide(-1)}
              aria-label={t('home.featured.previous')}
              className="flex h-11 w-11 items-center justify-center border border-brand-gold/30 bg-white text-brand-navy transition-colors hover:bg-brand-gold hover:text-white"
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => slide(1)}
              aria-label={t('home.featured.next')}
              className="flex h-11 w-11 items-center justify-center bg-brand-gold text-white transition-colors hover:bg-brand-gold-dark"
            >
              <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 sm:mt-8">
        {loading && (
          <div className="flex gap-4 overflow-hidden pb-4 pt-2 sm:gap-6" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-[82vw] max-w-[320px] shrink-0 animate-pulse border border-brand-navy/10 bg-white sm:w-70">
                <div className="aspect-16/10 bg-[#efe7dc]" />
                <div className="space-y-3 p-4">
                  <div className="h-3 w-1/3 bg-[#efe7dc]" />
                  <div className="h-6 w-2/3 bg-[#efe7dc]" />
                  <div className="h-3 w-1/2 bg-[#efe7dc]" />
                  <div className="h-11 bg-[#efe7dc]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && (failed || total === 0) && (
          <StateMessage title={t('home.featured.emptyTitle')} body={t('home.featured.emptyBody')} />
        )}

        {!loading && !failed && total > 0 && (
          <div
            ref={regionRef}
            role="region"
            aria-roledescription="carousel"
            aria-label={t('home.featured.carouselLabel')}
            className="overflow-hidden pb-4 pt-2 [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]"
          >
            {/* The trailing padding is one gap wide, so the row is exactly two
                identical halves and the -50% loop lands with no hop. */}
            <div
              key={activeTab?.id}
              ref={trackRef}
              className={
                'flex min-w-max gap-4 pe-4 sm:gap-6 sm:pe-6 ' +
                (goesLeft ? 'animate-featured-marquee-left' : 'animate-featured-marquee-right')
              }
            >
              {Array.from({ length: repeats * 2 }, () => grouped).flat().map((group, index) => {
                // Only the first copy is the real list. The rest exist to make
                // the loop seamless and fill the window — hidden from screen
                // readers and taken out of the tab order (focusable={false}) so
                // they never double up reading order or focus stops. They must
                // NOT be `inert`: the row scrolls through them for most of
                // every loop (a right-moving row even starts on them), so they
                // have to stay mouse/touch clickable.
                const isDuplicate = index >= total
                return (
                  <div
                    key={`${group.vehicle.id}-${index}`}
                    aria-hidden={isDuplicate || undefined}
                    // `flex` so the card stretches to the row's height: a two-line
                    // model name in one card must not leave its neighbours shorter.
                    className="flex w-[82vw] max-w-[320px] shrink-0 sm:w-70"
                  >
                    <VehicleCard
                      vehicle={group.vehicle}
                      detailHref={`/vehicles/${group.vehicle.id}`}
                      quantity={group.quantity}
                      focusable={!isDuplicate}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 sm:mt-6">
        <LinkButton to="/search" variant="outline" size="compact">
          {t('home.featured.viewAll')}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </LinkButton>
      </div>
    </section>
  )
}
