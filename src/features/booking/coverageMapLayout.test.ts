import { describe, it, expect } from 'vitest'
import {
  layoutCoverageMap,
  placeCallouts,
  projectToMapPercent,
  UAE_ANCHOR,
  MAP_RATIO,
  type LayoutMode,
  type PinOffset,
} from '@/features/booking/coverageMapLayout'

const PINS: PinOffset[] = [
  { city: 'Abu Dhabi', dx: -24, dy: 22 },
  { city: 'Al Ain', dx: -14, dy: 28 },
  { city: 'Dubai', dx: 0, dy: 0 },
  { city: 'Sharjah', dx: 12, dy: -14 },
  { city: 'Ajman', dx: 22, dy: -20 },
  { city: 'Umm Al Quwain', dx: 32, dy: -22 },
  { city: 'Ras Al Khaimah', dx: 40, dy: -18 },
  { city: 'Fujairah', dx: 42, dy: 2 },
]

/** [name, panel width, panel height, mode] — a wide desktop, the narrowest tablet in callouts mode, and two phones. */
const PANELS = [
  ['wide desktop', 1216, 460, 'callouts'],
  ['tablet', 720, 420, 'callouts'],
  ['phone', 358, 360, 'tap'],
  ['narrow phone', 300, 360, 'tap'],
] as const satisfies readonly (readonly [string, number, number, LayoutMode])[]

describe('projectToMapPercent', () => {
  it('puts the projection center longitude at the middle of the image', () => {
    expect(projectToMapPercent(30, 0).x).toBeCloseTo(50, 5)
  })

  it('wraps across the seam (the far-side meridian) to opposite edges', () => {
    expect(projectToMapPercent(-149.9, 0).x).toBeCloseTo(0, 0)
    expect(projectToMapPercent(-150.1, 0).x).toBeGreaterThan(99)
  })

  it('puts the UAE on the right half of the image, above the equator line', () => {
    expect(UAE_ANCHOR.x).toBeGreaterThan(50)
    expect(UAE_ANCHOR.x).toBeLessThan(65)
    expect(UAE_ANCHOR.y).toBeGreaterThan(30)
    expect(UAE_ANCHOR.y).toBeLessThan(50)
  })
})

describe('layoutCoverageMap', () => {
  it.each(PANELS)('covers the whole %s panel with the world image at true proportions', (_name, w, h, mode) => {
    const { stage } = layoutCoverageMap({ panelWidth: w, panelHeight: h, pins: PINS, mode })
    // Never exposes an edge…
    expect(stage.left).toBeLessThanOrEqual(0)
    expect(stage.top).toBeLessThanOrEqual(0)
    expect(stage.left + stage.width).toBeGreaterThanOrEqual(w - 0.001)
    expect(stage.top + stage.height).toBeGreaterThanOrEqual(h - 0.001)
    // …and is never stretched.
    expect(stage.width / stage.height).toBeCloseTo(MAP_RATIO, 5)
  })

  it.each(PANELS)('keeps every pin inside the %s panel', (_name, w, h, mode) => {
    const { points } = layoutCoverageMap({ panelWidth: w, panelHeight: h, pins: PINS, mode })
    for (const point of Object.values(points)) {
      expect(point.x).toBeGreaterThan(0)
      expect(point.x).toBeLessThan(w)
      expect(point.y).toBeGreaterThan(0)
      expect(point.y).toBeLessThan(h)
    }
  })

  it('keeps the hub pin exactly on the real UAE position of the world image', () => {
    const { stage, points } = layoutCoverageMap({ panelWidth: 1216, panelHeight: 460, pins: PINS, mode: 'callouts' })
    expect(points.Dubai.x).toBeCloseTo(stage.left + (UAE_ANCHOR.x / 100) * stage.width, 5)
    expect(points.Dubai.y).toBeCloseTo(stage.top + (UAE_ANCHOR.y / 100) * stage.height, 5)
  })

  it('keeps the wide-panel cluster compact — nowhere near sprawling across continents', () => {
    const { points } = layoutCoverageMap({ panelWidth: 1216, panelHeight: 460, pins: PINS, mode: 'callouts' })
    const xs = Object.values(points).map((p) => p.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(190.5)
  })

  it('keeps pins far enough apart on a phone to tap individually', () => {
    const { points } = layoutCoverageMap({ panelWidth: 358, panelHeight: 360, pins: PINS, mode: 'tap' })
    const all = Object.values(points)
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y)).toBeGreaterThanOrEqual(29.5)
      }
    }
  })

  it('handles a single pin (just the hub)', () => {
    const { points } = layoutCoverageMap({ panelWidth: 358, panelHeight: 360, pins: [{ city: 'Dubai', dx: 0, dy: 0 }], mode: 'tap' })
    expect(points.Dubai.x).toBeCloseTo(179, 0)
  })
})

describe('placeCallouts', () => {
  const PANEL_W = 1216
  const PANEL_H = 460
  const { points } = layoutCoverageMap({ panelWidth: PANEL_W, panelHeight: PANEL_H, pins: PINS, mode: 'callouts' })
  const placements = placeCallouts(points, PANEL_W, PANEL_H)

  it('gives every pin a label', () => {
    expect(Object.keys(placements).sort()).toEqual(PINS.map((p) => p.city).sort())
  })

  it('puts the top-row labels above the cluster and the bottom-row labels below it', () => {
    const ys = Object.values(points).map((p) => p.y)
    for (const placement of Object.values(placements)) {
      if (placement.row === 'top') expect(placement.y).toBeLessThan(Math.min(...ys))
      else expect(placement.y).toBeGreaterThan(Math.max(...ys))
    }
  })

  it('never lets two labels in the same row touch (a full card slot apart at least)', () => {
    for (const row of ['top', 'bottom'] as const) {
      const xs = Object.values(placements)
        .filter((p) => p.row === row)
        .map((p) => p.x)
        .sort((a, b) => a - b)
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(164 - 0.001)
    }
  })

  it('keeps every label card inside the panel', () => {
    for (const placement of Object.values(placements)) {
      expect(placement.x - 82).toBeGreaterThanOrEqual(0)
      expect(placement.x + 82).toBeLessThanOrEqual(PANEL_W)
    }
  })

  it('splits neighboring pins across opposite rows', () => {
    const ranked = Object.entries(points).sort((a, b) => a[1].x - b[1].x)
    for (let i = 1; i < ranked.length; i++) {
      expect(placements[ranked[i][0]].row).not.toBe(placements[ranked[i - 1][0]].row)
    }
  })

  it('returns nothing for no pins', () => {
    expect(placeCallouts({}, 800, 400)).toEqual({})
  })
})
