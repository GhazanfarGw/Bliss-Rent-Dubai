import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TickerBar } from '@/features/booking/TickerBar'

const fetchAllAvailableVehicles = vi.fn()

vi.mock('@/features/booking/api', () => ({
  fetchAllAvailableVehicles: (...args: unknown[]) => fetchAllAvailableVehicles(...args),
}))

interface FakeObserver {
  trigger: (entry: { isIntersecting: boolean }) => void
}

function getLastObserver(): FakeObserver {
  return (window as unknown as { __lastIntersectionObserver: FakeObserver }).__lastIntersectionObserver
}

function vehicleWithDailyRate(amount: number, currency = 'AED') {
  return { pricing: [{ term: 'daily', client_price: amount, currency }] }
}

describe('TickerBar', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.documentElement.dataset.headerVisible = 'true'
    const hero = document.createElement('div')
    hero.id = 'home-hero'
    document.body.appendChild(hero)
    fetchAllAvailableVehicles.mockReset()
  })

  it('shows the static service-highlight items even before any pricing data loads', async () => {
    fetchAllAvailableVehicles.mockResolvedValue([])
    render(<TickerBar />)
    expect(await screen.findAllByText(/24\/7 concierge/i)).not.toHaveLength(0)
    expect(screen.queryByText(/^From /)).not.toBeInTheDocument()
  })

  it('computes and shows the lowest real daily rate across the fleet — never a hardcoded figure', async () => {
    fetchAllAvailableVehicles.mockResolvedValue([vehicleWithDailyRate(140), vehicleWithDailyRate(95), vehicleWithDailyRate(220)])
    render(<TickerBar />)
    expect((await screen.findAllByText(/From AED 95 per day/i)).length).toBeGreaterThan(0)
  })

  it('is visible while the hero is in view, and hides once scrolled past it', async () => {
    fetchAllAvailableVehicles.mockResolvedValue([])
    render(<TickerBar />)
    const region = await screen.findByRole('region', { hidden: true })
    expect(region).toHaveAttribute('aria-hidden', 'false')

    act(() => {
      getLastObserver().trigger({ isIntersecting: false })
    })
    expect(region).toHaveAttribute('aria-hidden', 'true')
  })

  it('moves flush to the top when the header hides on scroll, so no gap is left behind', async () => {
    fetchAllAvailableVehicles.mockResolvedValue([])
    render(<TickerBar />)
    const region = await screen.findByRole('region', { hidden: true })
    expect(region.className).toContain('top-[var(--header-h)]')

    act(() => {
      window.dispatchEvent(new CustomEvent('headervisibilitychange', { detail: { visible: false } }))
    })
    expect(region.className).toContain('top-0')
  })
})
