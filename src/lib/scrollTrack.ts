/**
 * Helpers for the homepage's card rows (blog slider, featured vehicles). They
 * work from the row's real geometry and its own text direction, so the same
 * code is right in LTR and RTL and at every breakpoint.
 */

/** How far one card advances a row: the first card's width plus the gap after it. */
export function cardStep(track: HTMLElement): number {
  const card = track.firstElementChild as HTMLElement | null
  const gap = parseFloat(getComputedStyle(track).columnGap) || 0
  return (card?.getBoundingClientRect().width ?? track.clientWidth) + gap
}

/** Moves a scrolling, snapping row one card along, wrapping round at either end. */
export function scrollTrack(track: HTMLElement | null, direction: 1 | -1) {
  if (!track) return
  const distance = cardStep(track)
  const sign = getComputedStyle(track).direction === 'rtl' ? -1 : 1
  const max = Math.max(0, track.scrollWidth - track.clientWidth)
  const position = Math.abs(track.scrollLeft)

  let target: number
  if (direction === 1) target = position >= max - 4 ? 0 : position + distance
  else target = position <= 4 ? max : position - distance

  track.scrollTo?.({ left: sign * Math.min(Math.max(target, 0), max), behavior: 'smooth' })
}
