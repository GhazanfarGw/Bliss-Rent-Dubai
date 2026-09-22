import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, MapPin } from 'lucide-react'
import { fetchLocations } from '@/features/booking/api'
import { layoutCoverageMap, placeCallouts, type LayoutMode } from '@/features/booking/coverageMapLayout'
import { CITY_PHOTOS } from '@/features/booking/cityPhotos'
import { cityPagePath } from '@/features/content/cityGuides'
import { sortByOrder, TYPE_ICON } from '@/features/booking/locationDisplay'
import { WORLD_MAP_PATH, WORLD_MAP_VIEW_BOX } from '@/features/booking/worldMapPath'
import { Eyebrow } from '@/features/shared/ui/Eyebrow'
import { prefersReducedMotion } from '@/lib/motion'
import type { Location } from '@/types/domain'

/**
 * Where each UAE emirate/city we might have live pickup points in sits
 * relative to the UAE's real position on the world map (Dubai, the
 * anchor — see coverageMapLayout.ts), as a percent of the map image's
 * width (dx) / height (dy). The directions are the real ones (Abu Dhabi
 * southwest of Dubai, Sharjah/Ajman/Umm Al Quwain/Ras Al Khaimah up the
 * coast to the northeast, Fujairah on the east coast, Al Ain inland to
 * the southeast) but the distances are deliberately, heavily exaggerated
 * — at true world-map scale the whole UAE is under one percent of the
 * image, so every pin would collapse into a single dot. The layout scales
 * these offsets down (k) as far as it needs to so the whole cluster and
 * its labels fit the panel.
 *
 * `city` stays free-text and fully data-driven everywhere else in the app
 * (see docs/ARCHITECTURE.md — no hardcoded emirate list) — this table is
 * the one deliberate, additive exception, purely for pin placement. A
 * live city that isn't in it still appears (see the plain-chip fallback
 * below), just without a spot on the map.
 */
const CITY_OFFSET: Record<string, { dx: number; dy: number }> = {
  'Abu Dhabi': { dx: -24, dy: 22 },
  'Al Ain': { dx: -14, dy: 28 },
  Dubai: { dx: 0, dy: 0 },
  Sharjah: { dx: 12, dy: -14 },
  Ajman: { dx: 22, dy: -20 },
  'Umm Al Quwain': { dx: 32, dy: -22 },
  'Ras Al Khaimah': { dx: 40, dy: -18 },
  Fujairah: { dx: 42, dy: 2 },
}

/** Fallback panel size before it's been measured (and in jsdom, which has no layout). */
const DEFAULT_PANEL = { width: 1200, height: 460 }
/** Panel width from which every label shows at once — the panel's own width at Tailwind's `md` viewport breakpoint (768px viewport minus the section's 24px side padding). */
const ALL_LABELS_MIN_PANEL_WIDTH = 720
/** Approximate half-width of a label card, used to keep a tapped label inside the panel edge. */
const LABEL_HALF_WIDTH = 76
const LABEL_EDGE_GAP = 8
/** Hover preview card width (Tailwind `w-80`), used to keep it inside the panel edge. */
const PREVIEW_HALF_WIDTH = 160
/** Pickup points listed in a hover preview before "+N more". */
const PREVIEW_MAX_POINTS = 3
/** Tap mode: gap between the cluster's nearest dot and the popup card's near edge. */
const TAP_ROW_GAP = 26
/** Tap mode: room a popup card (~50-70px tall) needs between its far edge and the panel edge. */
const TAP_CARD_ROOM = 84

interface CityPin {
  city: string
  pointCount: number
  /** This city's real pickup/drop-off points (from `locations`). */
  points: Location[]
  offset: { dx: number; dy: number } | null
}

function summarizeCities(locations: Location[]): CityPin[] {
  const cities = Array.from(new Set(locations.map((l) => l.city))).sort((a, b) => sortByOrder(a, b, 'Dubai'))
  return cities.map((city) => {
    const points = locations.filter((l) => l.city === city)
    return { city, pointCount: points.length, points, offset: CITY_OFFSET[city] ?? null }
  })
}

/**
 * Homepage teaser for the full /locations page — an animated "coverage
 * map" built entirely from real, active pickup/drop-off points (same
 * fetchLocations() the search widget uses, so this can't drift out of
 * sync with what's actually bookable), pinned onto a real world map over
 * the actual UAE, all in the site's own light/warm palette (no navy panel
 * — this stays visually part of the same light homepage as every other
 * section around it, not a one-off dark band). Honest to Bliss Rent's
 * actual, currently-live coverage — no city names are hardcoded here or
 * in the translated copy, and a city with no offset in CITY_OFFSET still
 * lists as a plain chip rather than being silently dropped.
 *
 * The first city in `sortByOrder(..., 'Dubai')` is treated as the "hub"
 * (Dubai today, by construction, not a hardcoded name) — its pin gets a
 * small badge and every other live city gets a thin animated line drawn
 * back to it, echoing "expanding city by city from one base" without
 * claiming a route or delivery service that doesn't exist.
 */
export function LocationsPreviewSection() {
  const { t } = useTranslation()
  const [locations, setLocations] = useState<Location[] | null>(null)
  const [revealed, setRevealed] = useState(false)
  // Below `md` there's no room to show every pin's label at once (see the
  // label wrapper's own comment) — instead each pin is tappable, NordVPN-
  // map style: tapping a dot toggles ITS label open (closing any other),
  // tapping it again or tapping outside the map closes it. From `md` up
  // this is ignored — every label is always shown there.
  const [activePin, setActivePin] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  // Cities whose hover preview (photo + details) has been opened at least
  // once. The preview is only mounted from the first hover on, so the
  // photos aren't fetched for visitors who never hover a label.
  const [previewed, setPreviewed] = useState<ReadonlySet<string>>(new Set())
  const reducedMotion = prefersReducedMotion()

  useEffect(() => {
    if (!activePin) return
    function handleClickOutside(e: MouseEvent) {
      if (mapRef.current && !mapRef.current.contains(e.target as Node)) setActivePin(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activePin])

  useEffect(() => {
    let cancelled = false
    fetchLocations()
      .then((data) => {
        if (!cancelled) setLocations(data)
      })
      .catch(() => {
        if (!cancelled) setLocations([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const cities = useMemo(() => summarizeCities(locations ?? []), [locations])
  const placedCities = cities.filter((c) => c.offset)
  const unplacedCities = cities.filter((c) => !c.offset)
  const hub = placedCities[0]
  const placedKey = placedCities.map((c) => c.city).join('|')

  // Measure the map panel (it's a fixed height but a fluid width) so the
  // world image, the pins, and the labels can all be laid out in the same
  // pixel coordinate system — see coverageMapLayout.ts. Layout effect, so
  // the first paint already uses the real size instead of flashing the
  // default one.
  const [panel, setPanel] = useState(DEFAULT_PANEL)
  const hasPanel = placedCities.length > 0
  useLayoutEffect(() => {
    const el = mapRef.current
    if (!el) return
    function measure() {
      const rect = el!.getBoundingClientRect()
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      if (width > 0 && height > 0) setPanel((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasPanel])

  // Wide panel: every label shows at once, fanned out in rows above/below
  // a compact cluster and tied to their pins by leader lines. Narrow
  // panel: dots only, one tapped label at a time (see activePin above).
  const mode: LayoutMode = panel.width >= ALL_LABELS_MIN_PANEL_WIDTH ? 'callouts' : 'tap'
  const layout = useMemo(
    () =>
      layoutCoverageMap({
        panelWidth: panel.width,
        panelHeight: panel.height,
        pins: placedCities.map((c) => ({ city: c.city, dx: c.offset!.dx, dy: c.offset!.dy })),
        mode,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panel.width, panel.height, placedKey, mode],
  )
  const callouts = useMemo(
    () => (mode === 'callouts' ? placeCallouts(layout.points, panel.width, panel.height) : null),
    [layout, mode, panel.width, panel.height],
  )

  /**
   * Where a pin's label card goes, and where its leader line starts (the
   * card's edge nearest the pin: anchorX/anchorY). Callouts mode comes straight
   * from placeCallouts. In tap mode the single open label goes in a row
   * just above or below the WHOLE cluster (the half the tapped pin is in) —
   * never directly beside the pin, where a card would cover its neighbors'
   * dots and swallow the next tap. It's nudged sideways just enough to stay
   * inside the panel, never its leader, which runs straight up or down
   * from the dot.
   */
  function labelPlacement(city: string): { cardX: number; anchorX: number; anchorY: number; above: boolean } {
    const point = layout.points[city]
    const callout = callouts?.[city]
    if (callout) return { cardX: callout.x, anchorX: callout.x, anchorY: callout.y, above: callout.row === 'top' }
    const ys = Object.values(layout.points).map((p) => p.y)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const above = point.y <= (minY + maxY) / 2
    const anchorY = above
      ? Math.max(minY - TAP_ROW_GAP, TAP_CARD_ROOM)
      : Math.min(maxY + TAP_ROW_GAP, panel.height - TAP_CARD_ROOM)
    const overflowLeft = LABEL_EDGE_GAP - (point.x - LABEL_HALF_WIDTH)
    const overflowRight = point.x + LABEL_HALF_WIDTH - (panel.width - LABEL_EDGE_GAP)
    const shift = overflowLeft > 0 ? overflowLeft : overflowRight > 0 ? -overflowRight : 0
    return { cardX: point.x + shift, anchorX: point.x, anchorY, above }
  }

  /** Nudges a hover preview sideways just enough to stay inside the panel. */
  function previewShiftPx(cardX: number): number {
    const overflowLeft = LABEL_EDGE_GAP - (cardX - PREVIEW_HALF_WIDTH)
    if (overflowLeft > 0) return overflowLeft
    const overflowRight = cardX + PREVIEW_HALF_WIDTH - (panel.width - LABEL_EDGE_GAP)
    return overflowRight > 0 ? -overflowRight : 0
  }

  // One-time "grow in" once the real pins are known — skipped for
  // prefers-reduced-motion (final state renders immediately instead), and
  // double-rAF'd so the browser paints the pre-reveal state at least once
  // before the transition fires (a plain single effect can otherwise
  // collapse into one frame and never visibly transition).
  useEffect(() => {
    if (placedCities.length === 0 || reducedMotion) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setRevealed(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedCities.length, reducedMotion])

  const showReveal = reducedMotion || revealed

  return (
    <section className="relative isolate overflow-hidden bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <Eyebrow>{t('home.locationsPreview.eyebrow')}</Eyebrow>
        <h2 className="font-hero-serif mt-3 max-w-2xl text-2xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-3xl md:text-4xl">
          {t('home.locationsPreview.title')}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">{t('home.locationsPreview.subtitle')}</p>

        {locations === null && <p className="mt-8 text-sm text-text-muted">{t('home.locationsPreview.loading')}</p>}

        {locations !== null && cities.length === 0 && (
          <p className="mt-8 max-w-xl text-sm text-text-muted">{t('home.locationsPreview.emptyBody')}</p>
        )}

        {placedCities.length > 0 && (
          <div ref={mapRef} className="relative mt-6 sm:mt-8 h-[360px] w-full border border-brand-gold/15 bg-transparent sm:h-[420px] lg:h-[560px]">
            {/* Real, whole-world map (see worldMapPath.ts for how it's
                generated) — transparent panel background, so this sits
                directly on the section's own warm surface color rather than
                a separate white card. Its box (layout.stage) covers the
                panel at true proportions and is centered on the UAE
                cluster, so a narrow phone panel crops to Africa/Europe/the
                Middle East/India instead of squashing the continents. The
                pins below are placed on this same image (see
                coverageMapLayout.ts), over the real UAE. */}
            {/* The world image overflows the panel (it covers it, then is
                centered on the pins), so THIS layer clips it — not the panel
                itself, so a hover preview can open past the panel's edge. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <svg
                viewBox={WORLD_MAP_VIEW_BOX}
                preserveAspectRatio="none"
                className="absolute"
                style={{ left: layout.stage.left, top: layout.stage.top, width: layout.stage.width, height: layout.stage.height }}
              >
                <path d={WORLD_MAP_PATH} fill="rgba(92,9,49,0.16)" stroke="rgba(92,9,49,0.28)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
              </svg>
            </div>

            {/* One pixel-space SVG layer under the pins (same coordinates the
                pins use, so it always lines up with them): the dashed
                route lines from the hub to every other live city, plus a
                thin leader line tying each visible label to its pin
                (every label on a wide panel; only the tapped one on a
                phone). */}
            <svg viewBox={`0 0 ${panel.width} ${panel.height}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {hub &&
                placedCities.slice(1).map((c) => (
                  <line
                    key={`route-${c.city}`}
                    x1={layout.points[hub.city].x}
                    y1={layout.points[hub.city].y}
                    x2={layout.points[c.city].x}
                    y2={layout.points[c.city].y}
                    stroke="rgba(92,9,49,0.4)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    className={!reducedMotion ? 'animate-coverage-route' : undefined}
                    style={{ opacity: showReveal ? 1 : 0, transition: 'opacity 700ms ease-out' }}
                  />
                ))}
              {placedCities
                .filter((c) => mode === 'callouts' || activePin === c.city)
                .map((c) => {
                  const { anchorX, anchorY } = labelPlacement(c.city)
                  return (
                    <line
                      key={`leader-${c.city}`}
                      x1={anchorX}
                      y1={anchorY}
                      x2={layout.points[c.city].x}
                      y2={layout.points[c.city].y}
                      stroke="rgba(92,9,49,0.35)"
                      strokeWidth={1}
                      style={{ opacity: showReveal || activePin === c.city ? 1 : 0, transition: 'opacity 700ms ease-out' }}
                    />
                  )
                })}
            </svg>

            {placedCities.map((pin) => {
              const point = layout.points[pin.city]
              return (
                <div key={pin.city} className="absolute" style={{ left: point.x, top: point.y }}>
                  <div className="relative -translate-x-1/2 -translate-y-1/2">
                    {/* On a phone-width panel the dot is a real tap target
                        (extra padding/negative margin grows the hit area
                        well past the tiny visual circle, without shifting
                        it) — tapping toggles this pin's label open, same
                        tap-a-dot-see-the-place interaction as NordVPN's
                        map. From `md` up it's non-interactive: every label
                        is already always shown there. */}
                    <button
                      type="button"
                      onClick={() => setActivePin((cur) => (cur === pin.city ? null : pin.city))}
                      aria-expanded={activePin === pin.city}
                      aria-label={pin.city}
                      className="relative -m-2 flex p-2 md:pointer-events-none"
                    >
                      {/* The dot carries a small location-pin glyph so it
                          reads as "a city's location" at a glance, not just
                          a bare dot. Bigger on a phone (a real tap target),
                          and the tapped one is lifted with a champagne ring
                          so it's clear which dot the open label belongs to. */}
                      <span className="relative flex h-6 w-6 md:h-4.5 md:w-4.5">
                        {!reducedMotion && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-champagne opacity-75" />}
                        <span
                          className={
                            'relative inline-flex h-full w-full items-center justify-center rounded-full border-2 border-white bg-brand-gold text-white shadow-(--shadow-card) transition-transform duration-200 ' +
                            (activePin === pin.city ? 'scale-125 ring-2 ring-brand-champagne' : '')
                          }
                        >
                          <MapPin className="h-3 w-3 md:h-2.5 md:w-2.5" aria-hidden="true" />
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Label cards, positioned in the same panel-pixel space as the
                pins (see labelPlacement). Physical left/top + a fixed
                translate — deliberately not start/end-relative — because a
                map's spatial layout must stay pinned to the same physical
                point in RTL too; only the card's own text alignment (see
                `text-start` on the Link) follows reading direction.

                Below `md` there isn't room for every card at once, so only
                the tapped pin's label shows there (`hidden` unless open).
                From `md` up `md:flex` ignores that toggle: always shown. */}
            {placedCities.map((pin, i) => {
              const isOpenOnMobile = activePin === pin.city
              const { cardX, anchorY, above } = labelPlacement(pin.city)
              return (
                <div
                  key={pin.city}
                  data-label-for={pin.city}
                  className={(isOpenOnMobile ? 'flex ' : 'hidden ') + 'group/label absolute hover:z-30 focus-within:z-30 md:flex'}
                  style={{ left: cardX, top: anchorY, transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)' }}
                  onPointerEnter={() => setPreviewed((prev) => (prev.has(pin.city) ? prev : new Set(prev).add(pin.city)))}
                >
                  <div
                    className={
                      'transition-all duration-700 ease-out ' +
                      // A direct tap (isOpenOnMobile) shows at full opacity right
                      // away regardless of the entrance animation's own timing.
                      (showReveal || isOpenOnMobile ? 'opacity-100 translate-y-0' : 'opacity-0 ' + (above ? 'translate-y-1' : '-translate-y-1'))
                    }
                    style={{ transitionDelay: reducedMotion ? '0ms' : `${i * 120}ms` }}
                  >
                    <Link
                      to={cityPagePath(pin.city) ?? '/locations'}
                      className="group flex min-w-[7.5rem] flex-col items-start gap-0.5 border border-brand-gold/25 bg-white px-2.5 py-1.5 text-start shadow-(--shadow-card) transition-all duration-200 hover:border-brand-gold hover:shadow-(--shadow-card-hover)"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
                        {pin.city}
                        {pin === hub && (
                          <span className="border border-brand-gold/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-brand-gold-dark">
                            {t('home.locationsPreview.hubBadge')}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-text-muted">{t('pages.locations.pointCount', { count: pin.pointCount })}</span>
                    </Link>
                  </div>
                  {previewed.has(pin.city) && <CityPreview pin={pin} above={above} shiftPx={previewShiftPx(cardX)} isHub={pin === hub} />}
                </div>
              )
            })}
          </div>
        )}

        {/* Only cities with no spot on the map (see CITY_OFFSET) get a chip —
            placed cities are reached through their pin's label, on every
            screen size. */}
        {unplacedCities.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {unplacedCities.map((c) => (
              <CityChip key={c.city} city={c.city} pointCount={c.pointCount} />
            ))}
          </div>
        )}

        <Link
          to="/locations"
          className="group mt-10 inline-flex items-center gap-2 border border-brand-gold/60 bg-brand-gold px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_16px_rgba(186,142,92,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(186,142,92,0.32)]"
        >
          {t('home.locationsPreview.viewAll')}
          <ArrowRight className="h-4 w-4 rtl:rotate-180 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

/**
 * Desktop hover card for a city's label: a real photo of the city plus
 * short details from its real `locations` rows (how many pickup points,
 * and the first few by name). Pointer-events-none — it's a preview, not a
 * control — and shown purely by CSS while the label (or its link) is
 * hovered/focused, from `lg` up (below that the panel is too short to fit
 * it and there's no hover on touch). Sits on the side of the label away
 * from the pin cluster, so it never covers the pins or another label.
 */
function CityPreview({ pin, above, shiftPx, isHub }: { pin: CityPin; above: boolean; shiftPx: number; isHub: boolean }) {
  const { t } = useTranslation()
  const photo = CITY_PHOTOS[pin.city]
  const shown = pin.points.slice(0, PREVIEW_MAX_POINTS)
  const extra = pin.points.length - shown.length
  return (
    <div
      aria-hidden="true"
      data-city-preview={pin.city}
      className={
        'pointer-events-none absolute left-1/2 z-30 hidden w-80 opacity-0 transition-opacity duration-200 ease-out group-hover/label:opacity-100 group-focus-within/label:opacity-100 lg:block ' +
        (above ? 'bottom-full mb-2' : 'top-full mt-2')
      }
      style={{ transform: `translateX(calc(-50% + ${shiftPx}px))` }}
    >
      <div className="flex overflow-hidden border border-brand-gold/25 bg-white shadow-(--shadow-card-hover)">
        <div className="relative w-28 shrink-0 bg-brand-lavender">
          {photo ? (
            <img src={photo.src} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-brand-gold/40">
              <MapPin className="h-8 w-8" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 p-3 text-start">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-navy">
            <span className="truncate">{pin.city}</span>
            {isHub && (
              <span className="shrink-0 border border-brand-gold/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-brand-gold-dark">
                {t('home.locationsPreview.hubBadge')}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">{t('pages.locations.pointCount', { count: pin.pointCount })}</p>
          <ul className="mt-2 space-y-1 text-xs text-brand-navy/80">
            {shown.map((point) => (
              <li key={point.id} className="flex items-center gap-1.5">
                <span className="shrink-0" aria-hidden="true">
                  {TYPE_ICON[point.type]}
                </span>
                <span className="truncate">{point.name}</span>
              </li>
            ))}
            {extra > 0 && <li className="text-text-muted">{t('home.locationsPreview.morePoints', { count: extra })}</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}

function CityChip({ city, pointCount }: { city: string; pointCount: number }) {
  const { t } = useTranslation()
  return (
    <Link
      to="/locations"
      className="inline-flex items-center gap-1.5 border border-brand-gold/25 bg-white px-3 py-1.5 text-xs font-medium text-brand-navy shadow-none transition-colors hover:border-brand-gold"
    >
      <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
      {city} · {t('pages.locations.pointCount', { count: pointCount })}
    </Link>
  )
}
