import { WORLD_MAP_PROJECTION, WORLD_MAP_VIEW_BOX } from '@/features/booking/worldMapPath'

/**
 * Geometry for the homepage coverage map (LocationsPreviewSection): one
 * shared coordinate system for the world-map image AND the city pins, so
 * the pins always sit over the real UAE no matter how wide or narrow the
 * panel is.
 *
 * The world image is "covered" over the panel (scaled up until it fills
 * both dimensions, like CSS `object-fit: cover`) and shifted so the pin
 * cluster is centered in the panel — cropping ocean and far-off
 * continents on a narrow phone panel rather than squashing anything.
 * Pins are then placed at the real UAE's position on that image plus a
 * per-city offset, scaled by `k`. At true scale every emirate would
 * collapse into the same dot (the UAE is well under 1% of a world map),
 * so the offsets deliberately exaggerate the spacing — but only as much
 * as the interaction needs, so the cluster still sits over the Arabian
 * peninsula rather than sprawling across continents:
 *
 * - `callouts` (wide panels): pins aren't interactive and every label is
 *   visible at once, so the cluster stays compact and the labels are
 *   fanned out in two rows above/below it, tied to their pins by leader
 *   lines (see placeCallouts).
 * - `tap` (phone-width panels): pins are tap targets showing one label at
 *   a time, so `k` is the smallest exaggeration that keeps neighboring
 *   pins comfortably tappable.
 */

const [, , viewBoxWidth, viewBoxHeight] = WORLD_MAP_VIEW_BOX.split(' ').map(Number)

/** Width / height of the world image. */
export const MAP_RATIO = viewBoxWidth / viewBoxHeight

/** Where a real lon/lat lands on the image, in percent of its width/height (same equirectangular math the generator used). */
export function projectToMapPercent(lon: number, lat: number): { x: number; y: number } {
  const { centerLon, latMin, latMax } = WORLD_MAP_PROJECTION
  const deltaLon = ((((lon - centerLon) % 360) + 540) % 360) - 180
  return { x: 50 + (deltaLon / 360) * 100, y: ((latMax - lat) / (latMax - latMin)) * 100 }
}

/** The UAE (Dubai) on the image — every pin is placed relative to this. */
export const UAE_ANCHOR = projectToMapPercent(55.3, 25.2)

export type LayoutMode = 'callouts' | 'tap'

export interface PinOffset {
  city: string
  /** Offset from the anchor at k = 1, in percent of the image's width. */
  dx: number
  /** Offset from the anchor at k = 1, in percent of the image's height. */
  dy: number
}

export interface CoverageLayoutInput {
  panelWidth: number
  panelHeight: number
  pins: PinOffset[]
  mode: LayoutMode
}

export interface CoverageLayout {
  /** The world image's box, in panel pixels (its left/top are ≤ 0 — it overflows and is cropped by the panel). */
  stage: { left: number; top: number; width: number; height: number }
  /** The exaggeration actually used (1 = the offsets as authored). */
  k: number
  /** Each pin's center, in panel pixels. */
  points: Record<string, { x: number; y: number }>
}

const K_MAX = 1
const K_MIN = 0.05
const K_STEP = 0.0125

/** Callouts mode: how wide (px) the compact cluster aims to be, as a share of the panel width, within a floor/ceiling. */
const CALLOUT_CLUSTER_SHARE = 0.155
const CALLOUT_CLUSTER_MIN = 110
const CALLOUT_CLUSTER_MAX = 190
/** Tap mode: the closest two pins may be — comfortably more than a dot, so each is individually tappable. */
const TAP_MIN_PIN_DISTANCE = 30

/** Room a pin needs inside the panel: callouts leave the rows for labels above/below; tap only needs the dot (its one popup can nudge itself sideways). */
const MARGINS: Record<LayoutMode, { x: number; y: number }> = {
  callouts: { x: 24, y: 112 },
  tap: { x: 18, y: 18 },
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function layoutCoverageMap({ panelWidth, panelHeight, pins, mode }: CoverageLayoutInput): CoverageLayout {
  const stageWidth = Math.max(panelWidth, panelHeight * MAP_RATIO)
  const stageHeight = stageWidth / MAP_RATIO
  const pxPerPercentX = stageWidth / 100
  const pxPerPercentY = stageHeight / 100
  const anchorX = UAE_ANCHOR.x * pxPerPercentX
  const anchorY = UAE_ANCHOR.y * pxPerPercentY
  const { x: marginX, y: marginY } = MARGINS[mode]

  const minDx = Math.min(0, ...pins.map((p) => p.dx))
  const maxDx = Math.max(0, ...pins.map((p) => p.dx))
  const minDy = Math.min(0, ...pins.map((p) => p.dy))
  const maxDy = Math.max(0, ...pins.map((p) => p.dy))

  function place(k: number) {
    // Center the cluster's bounding box in the panel, then keep the image
    // covering it (left/top can't go positive or expose an edge).
    const clusterCenterX = anchorX + ((minDx + maxDx) / 2) * k * pxPerPercentX
    const clusterCenterY = anchorY + ((minDy + maxDy) / 2) * k * pxPerPercentY
    const left = clamp(panelWidth / 2 - clusterCenterX, panelWidth - stageWidth, 0)
    const top = clamp(panelHeight / 2 - clusterCenterY, panelHeight - stageHeight, 0)
    const fits =
      left + anchorX + minDx * k * pxPerPercentX >= marginX &&
      left + anchorX + maxDx * k * pxPerPercentX <= panelWidth - marginX &&
      top + anchorY + minDy * k * pxPerPercentY >= marginY &&
      top + anchorY + maxDy * k * pxPerPercentY <= panelHeight - marginY
    return { left, top, fits }
  }

  function pointsAt(k: number, left: number, top: number) {
    const points: CoverageLayout['points'] = {}
    for (const pin of pins) {
      points[pin.city] = {
        x: left + anchorX + pin.dx * k * pxPerPercentX,
        y: top + anchorY + pin.dy * k * pxPerPercentY,
      }
    }
    return points
  }

  function closestPinDistance(k: number) {
    const points = Object.values(pointsAt(k, 0, 0))
    let closest = Infinity
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        closest = Math.min(closest, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y))
      }
    }
    return closest
  }

  // Largest exaggeration at which everything still fits the panel.
  let kFit = K_MAX
  while (!place(kFit).fits && kFit - K_STEP >= K_MIN) kFit = Math.round((kFit - K_STEP) * 10000) / 10000

  let k: number
  if (mode === 'callouts') {
    const span = (maxDx - minDx) * pxPerPercentX
    const targetSpan = clamp(panelWidth * CALLOUT_CLUSTER_SHARE, CALLOUT_CLUSTER_MIN, CALLOUT_CLUSTER_MAX)
    k = span > 0 ? Math.min(kFit, targetSpan / span) : kFit
  } else {
    k = K_MIN
    while (k < kFit && closestPinDistance(k) < TAP_MIN_PIN_DISTANCE) k = Math.round((k + K_STEP) * 10000) / 10000
    k = Math.min(k, kFit)
  }

  const { left, top } = place(k)
  return { stage: { left, top, width: stageWidth, height: stageHeight }, k, points: pointsAt(k, left, top) }
}

export interface CalloutPlacement {
  /** Center x of the label card, in panel pixels. */
  x: number
  /** The card's edge nearest the pins (its bottom edge for the top row, its top edge for the bottom row), in panel pixels — where the leader line starts. */
  y: number
  row: 'top' | 'bottom'
}

/** Room between the cluster and the near edge of a label row. */
const CALLOUT_ROW_GAP = 30
/** Space a label card (plus a gap) takes along its row — cards are ~120-150px wide. */
const CALLOUT_SLOT = 164
const CALLOUT_EDGE = 8

/**
 * Callouts mode label positions: pins alternate between a row above and a
 * row below the cluster (ranked left to right, so pins that sit close
 * together always land in opposite rows), and within a row each label
 * sits at its pin's x — pushed apart, then re-centered and clamped inside
 * the panel, whenever two would touch. Each label connects to its pin
 * with a leader line, so a label can drift away from its pin without
 * losing the association.
 */
export function placeCallouts(
  points: CoverageLayout['points'],
  panelWidth: number,
  panelHeight: number,
): Record<string, CalloutPlacement> {
  const entries = Object.entries(points)
  if (entries.length === 0) return {}
  const ys = entries.map(([, p]) => p.y)
  const topRowY = Math.max(CALLOUT_EDGE + 80, Math.min(...ys) - CALLOUT_ROW_GAP)
  const bottomRowY = Math.min(panelHeight - CALLOUT_EDGE - 80, Math.max(...ys) + CALLOUT_ROW_GAP)

  const ranked = entries.sort((a, b) => a[1].x - b[1].x)
  const rows: Record<'top' | 'bottom', [string, number][]> = { top: [], bottom: [] }
  ranked.forEach(([city, point], index) => rows[index % 2 === 0 ? 'top' : 'bottom'].push([city, point.x]))

  const minX = CALLOUT_EDGE + CALLOUT_SLOT / 2
  const maxX = panelWidth - CALLOUT_EDGE - CALLOUT_SLOT / 2
  const placements: Record<string, CalloutPlacement> = {}

  for (const row of ['top', 'bottom'] as const) {
    const items = rows[row]
    const desired = items.map(([, x]) => x)
    // Forward pass: keep each label at least one slot right of the last.
    const xs = desired.map((x) => clamp(x, minX, maxX))
    for (let i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i], xs[i - 1] + CALLOUT_SLOT)
    // Re-center the pushed-apart group on where its pins actually are…
    const shift = desired.reduce((sum, x, i) => sum + (x - xs[i]), 0) / (xs.length || 1)
    for (let i = 0; i < xs.length; i++) xs[i] += shift
    // …then pull anything hanging off the panel back in, keeping the gaps.
    for (let i = xs.length - 1; i >= 0; i--) xs[i] = Math.min(xs[i], i === xs.length - 1 ? maxX : xs[i + 1] - CALLOUT_SLOT)
    for (let i = 0; i < xs.length; i++) xs[i] = Math.max(xs[i], i === 0 ? minX : xs[i - 1] + CALLOUT_SLOT)
    items.forEach(([city], i) => {
      placements[city] = { x: xs[i], y: row === 'top' ? topRowY : bottomRowY, row }
    })
  }
  return placements
}
