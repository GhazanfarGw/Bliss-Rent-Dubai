import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Hero } from '@/features/booking/Hero'

describe('Hero', () => {
  it('renders a single static hero image with its heading and CTA', () => {
    render(<Hero />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('loading', 'eager')

    const bookNowLink = screen.getByRole('link', { name: /book now/i })
    expect(bookNowLink).toBeInTheDocument()
    expect(bookNowLink).toHaveAttribute('href', '/book')

    const viewFleetLink = screen.getByRole('link', { name: /view fleet/i })
    expect(viewFleetLink).toHaveAttribute('href', '/search')
  })

  it('does not render any carousel controls (dots, arrows, slide counter)', () => {
    render(<Hero />)

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

    it('auto-changes the heading text over time, while the image stays the same', () => {
      render(<Hero />)
      const firstTitle = screen.getByRole('heading', { level: 1 }).textContent
      const image = screen.getAllByRole('img')[0]
      const imageSrcBefore = image.getAttribute('src')

      act(() => {
        vi.advanceTimersByTime(6000)
      })

      const secondTitle = screen.getByRole('heading', { level: 1 }).textContent
      expect(secondTitle).not.toBe(firstTitle)
      // The image itself never rotates — only the text does.
      expect(screen.getAllByRole('img')[0]).toHaveAttribute('src', imageSrcBefore)
    })

    it('does not auto-change the heading when the user prefers reduced motion', () => {
      const matchMediaMock = vi.fn().mockReturnValue({ matches: true })
      vi.stubGlobal('matchMedia', matchMediaMock)

      render(<Hero />)
      const firstTitle = screen.getByRole('heading', { level: 1 }).textContent

      act(() => {
        vi.advanceTimersByTime(30000)
      })

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(firstTitle)
      vi.unstubAllGlobals()
    })
  })
})
