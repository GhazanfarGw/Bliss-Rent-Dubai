import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Hero } from '@/features/booking/Hero'

// Hero renders a real <Link to="/search"> (the "View fleet" CTA), which
// needs a Router context to exist at all — same MemoryRouter-wrapping
// convention as VehicleCard.test.tsx.
function renderHero() {
  return render(
    <MemoryRouter>
      <Hero />
    </MemoryRouter>,
  )
}

describe('Hero', () => {
  it('renders a single autoplaying hero video with its heading and CTAs', () => {
    renderHero()

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Drive Your Journey with Bliss Rent')

    // The pinned background is a muted/looping/autoplaying video (no img)
    // unless the user prefers reduced motion — see the fallback test below.
    expect(screen.queryAllByRole('img')).toHaveLength(0)
    const video = document.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('autoplay')
    expect(video).toHaveAttribute('loop')
    expect(video).toHaveProperty('muted', true)

    const bookNowLink = screen.getByRole('link', { name: /book now/i })
    expect(bookNowLink).toBeInTheDocument()
    expect(bookNowLink).toHaveAttribute('href', '/search?mode=book')

    const viewFleetLink = screen.getByRole('link', { name: /view fleet/i })
    expect(viewFleetLink).toHaveAttribute('href', '/search')
  })

  it('shows one supporting sentence and an eyebrow line under a single heading', () => {
    renderHero()

    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getByText('Premium car rental in Dubai, UAE')).toBeInTheDocument()
    expect(screen.getByText(/Real cars, real availability and clear prices/)).toBeInTheDocument()
  })

  it('does not render any carousel controls (dots, arrows, slide counter)', () => {
    renderHero()

    expect(screen.queryByRole('region', { name: /carousel/i })).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /go to slide/i })).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /previous slide/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next slide/i })).not.toBeInTheDocument()
  })

  describe('stillness — the video is the only thing that moves', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('never rotates or swaps the heading and body text over time', () => {
      renderHero()
      const firstTitle = screen.getByRole('heading', { level: 1 }).textContent
      const firstBody = screen.getByText(/Real cars, real availability/).textContent

      act(() => {
        vi.advanceTimersByTime(60000)
      })

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(firstTitle)
      expect(screen.getByText(/Real cars, real availability/).textContent).toBe(firstBody)
    })

    it('carries no CSS animation classes anywhere in the hero content', () => {
      const { container } = renderHero()
      expect(container.querySelector('[class*="animate-"]')).toBeNull()
    })

    it('falls back to a still image (no video) when the user prefers reduced motion', () => {
      const matchMediaMock = vi.fn().mockReturnValue({ matches: true })
      vi.stubGlobal('matchMedia', matchMediaMock)

      renderHero()

      expect(document.querySelector('video')).not.toBeInTheDocument()
      const images = screen.getAllByRole('img')
      expect(images).toHaveLength(1)
      expect(images[0]).toHaveAttribute('loading', 'eager')
      vi.unstubAllGlobals()
    })
  })

  it('has no numbers strip (vehicles / categories / cities) — removed at the owner\'s request', () => {
    renderHero()

    expect(screen.queryByText('Vehicles ready to book')).not.toBeInTheDocument()
    expect(screen.queryByText('Vehicle categories')).not.toBeInTheDocument()
    expect(screen.queryByText('Cities served')).not.toBeInTheDocument()
  })

  describe('scroll cue', () => {
    it('smooth-scrolls to the booking section when clicked', () => {
      document.body.innerHTML = '<div id="booking-section"></div>'
      const scrollIntoView = vi.fn()
      document.getElementById('booking-section')!.scrollIntoView = scrollIntoView

      renderHero()
      screen.getByRole('button', { name: /scroll to explore/i }).click()

      expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
    })
  })
})
