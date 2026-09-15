import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Hero } from '@/features/booking/Hero'

const fetchAllAvailableVehicles = vi.fn()
const fetchLocations = vi.fn()

vi.mock('@/features/booking/api', () => ({
  fetchAllAvailableVehicles: (...args: unknown[]) => fetchAllAvailableVehicles(...args),
  fetchLocations: (...args: unknown[]) => fetchLocations(...args),
}))

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
  beforeEach(() => {
    fetchAllAvailableVehicles.mockReset().mockResolvedValue([])
    fetchLocations.mockReset().mockResolvedValue([])
  })

  it('renders a single autoplaying hero video with its heading and CTA', () => {
    renderHero()

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()

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
    expect(bookNowLink).toHaveAttribute('href', '/book')

    const viewFleetLink = screen.getByRole('link', { name: /view fleet/i })
    expect(viewFleetLink).toHaveAttribute('href', '/search')
  })

  it('does not render any carousel controls (dots, arrows, slide counter)', () => {
    renderHero()

    expect(screen.queryByRole('region', { name: /carousel/i })).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /go to slide/i })).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /previous slide/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next slide/i })).not.toBeInTheDocument()
  })

  describe('heading/body text rotation', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('auto-changes the heading text over time, while the video stays the same', () => {
      renderHero()
      const firstTitle = screen.getByRole('heading', { level: 1 }).textContent
      const video = document.querySelector('video')
      const posterBefore = video?.getAttribute('poster')

      act(() => {
        vi.advanceTimersByTime(6000)
      })

      const secondTitle = screen.getByRole('heading', { level: 1 }).textContent
      expect(secondTitle).not.toBe(firstTitle)
      // The background video itself never rotates — only the text does.
      expect(document.querySelector('video')).toHaveAttribute('poster', posterBefore)
    })

    it('does not auto-change the heading when the user prefers reduced motion', () => {
      const matchMediaMock = vi.fn().mockReturnValue({ matches: true })
      vi.stubGlobal('matchMedia', matchMediaMock)

      renderHero()
      const firstTitle = screen.getByRole('heading', { level: 1 }).textContent

      act(() => {
        vi.advanceTimersByTime(30000)
      })

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(firstTitle)
      vi.unstubAllGlobals()
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

  describe('live trust-signal row', () => {
    it('shows the real fetched vehicle and city counts once loaded', async () => {
      fetchAllAvailableVehicles.mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }])
      fetchLocations.mockResolvedValue([
        { city: 'Dubai' },
        { city: 'Dubai' },
        { city: 'Abu Dhabi' },
      ])

      renderHero()

      // The count and label render as one interpolated string (see
      // pages.about.stats.vehicles/cities in en.ts), not a standalone
      // number node — matches the actual "N vehicles/cities…" text.
      await waitFor(() => expect(screen.getByText(/3 vehicles ready to book/i)).toBeInTheDocument())
      expect(screen.getByText(/2 cities we operate in/i)).toBeInTheDocument()
    })

    it('renders no stat row at all when the fetch fails — no fake fallback', async () => {
      fetchAllAvailableVehicles.mockRejectedValue(new Error('network error'))
      fetchLocations.mockResolvedValue([])

      renderHero()

      await waitFor(() => expect(fetchAllAvailableVehicles).toHaveBeenCalled())
      expect(screen.queryByText(/vehicles ready to book/i)).not.toBeInTheDocument()
    })
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
