import { describe, it, expect, vi, afterEach } from 'vitest'
import { cardStep, scrollTrack } from '@/lib/scrollTrack'

interface Geometry {
  scrollLeft?: number
  clientWidth?: number
  scrollWidth?: number
  cardWidth?: number
  gap?: number
  direction?: 'ltr' | 'rtl'
}

/** A row whose layout is faked — jsdom does none — with a spy on its scrollTo. */
function makeTrack({ scrollLeft = 0, clientWidth = 600, scrollWidth = 1800, cardWidth = 300, gap = 0, direction = 'ltr' }: Geometry = {}) {
  const track = document.createElement('div')
  const card = document.createElement('div')
  track.appendChild(card)

  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ width: cardWidth } as DOMRect)
  Object.defineProperty(track, 'clientWidth', { value: clientWidth, configurable: true })
  Object.defineProperty(track, 'scrollWidth', { value: scrollWidth, configurable: true })
  Object.defineProperty(track, 'scrollLeft', { value: scrollLeft, configurable: true })
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ columnGap: `${gap}px`, direction } as CSSStyleDeclaration)

  const scrollTo = vi.fn()
  track.scrollTo = scrollTo as unknown as typeof track.scrollTo
  return { track, scrollTo }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('cardStep', () => {
  it('is the first card width plus the gap after it', () => {
    expect(cardStep(makeTrack({ cardWidth: 280, gap: 24 }).track)).toBe(304)
  })

  it('has no gap when the row sets none', () => {
    expect(cardStep(makeTrack({ cardWidth: 280 }).track)).toBe(280)
  })
})

describe('scrollTrack', () => {
  it('moves forward by one card plus the gap', () => {
    const { track, scrollTo } = makeTrack({ gap: 24 })
    scrollTrack(track, 1)
    expect(scrollTo).toHaveBeenCalledWith({ left: 324, behavior: 'smooth' })
  })

  it('moves back by one card plus the gap', () => {
    const { track, scrollTo } = makeTrack({ gap: 24, scrollLeft: 648 })
    scrollTrack(track, -1)
    expect(scrollTo).toHaveBeenCalledWith({ left: 324, behavior: 'smooth' })
  })

  it('never scrolls past the end of the row', () => {
    const { track, scrollTo } = makeTrack({ gap: 24, scrollLeft: 1000 }) // max is 1200
    scrollTrack(track, 1)
    expect(scrollTo).toHaveBeenCalledWith({ left: 1200, behavior: 'smooth' })
  })

  it('wraps to the start when "next" is pressed at the end', () => {
    const { track, scrollTo } = makeTrack({ scrollLeft: 1200 })
    scrollTrack(track, 1)
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' })
  })

  it('wraps to the end when "previous" is pressed at the start', () => {
    const { track, scrollTo } = makeTrack()
    scrollTrack(track, -1)
    expect(scrollTo).toHaveBeenCalledWith({ left: 1200, behavior: 'smooth' })
  })

  it('scrolls the other way in a right-to-left row', () => {
    const { track, scrollTo } = makeTrack({ gap: 24, scrollLeft: -324, direction: 'rtl' })
    scrollTrack(track, 1)
    expect(scrollTo).toHaveBeenCalledWith({ left: -648, behavior: 'smooth' })
  })

  it('does nothing without a row', () => {
    expect(() => scrollTrack(null, 1)).not.toThrow()
  })
})
