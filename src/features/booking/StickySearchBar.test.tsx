import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { StickySearchBar } from '@/features/booking/StickySearchBar'

vi.mock('@/features/booking/api', () => ({
  fetchLocations: vi.fn().mockResolvedValue([]),
}))

interface FakeObserver {
  trigger: (entry: { isIntersecting: boolean; boundingClientRect: { top: number } }) => void
}

function getLastObserver(): FakeObserver {
  return (window as unknown as { __lastIntersectionObserver: FakeObserver }).__lastIntersectionObserver
}

describe('StickySearchBar', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    // The bar watches an element with this id — StickySearchBar doesn't
    // render it itself (BookingSearchSection does, on the real homepage).
    const target = document.createElement('div')
    target.id = 'booking-section'
    document.body.appendChild(target)
  })

  it('is hidden while the booking section is in view', () => {
    render(<StickySearchBar onSearch={vi.fn()} />)
    const region = screen.getByRole('region', { hidden: true })
    expect(region).toHaveAttribute('aria-hidden', 'true')
  })

  it('appears once the booking section has scrolled above the viewport, and hides again when scrolled back', () => {
    render(<StickySearchBar onSearch={vi.fn()} />)

    act(() => {
      getLastObserver().trigger({ isIntersecting: false, boundingClientRect: { top: -400 } })
    })
    const visibleRegion = screen.getByRole('region', { name: /quick search/i })
    expect(visibleRegion).toHaveAttribute('aria-hidden', 'false')

    act(() => {
      getLastObserver().trigger({ isIntersecting: true, boundingClientRect: { top: 20 } })
    })
    expect(screen.getByRole('region', { hidden: true })).toHaveAttribute('aria-hidden', 'true')
  })

  it('reuses SearchWidget in compact mode — no duplicated search form', async () => {
    render(<StickySearchBar onSearch={vi.fn()} />)
    // The bar starts hidden (inert) until scrolled past the booking
    // section — query with `hidden: true` to reach it in that state.
    expect(await screen.findByRole('button', { name: /search cars/i, hidden: true })).toBeInTheDocument()
  })
})
