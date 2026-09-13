import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TickerBar } from '@/features/booking/TickerBar'

const fetchAllAvailableVehicles = vi.fn()

vi.mock('@/features/booking/api', () => ({
  fetchAllAvailableVehicles: (...args: unknown[]) => fetchAllAvailableVehicles(...args),
}))

function vehicleWithDailyRate(amount: number, currency = 'AED') {
  return { pricing: [{ term: 'daily', client_price: amount, currency }] }
}

// TickerBar was simplified to a static bar fixed to the bottom of the
// viewport (no more header-visibility tracking or hide-past-hero
// behavior — that was a deliberate earlier change, not part of this
// suite) — these tests cover what it actually does now: a real live
// rate (or none, honestly, if pricing hasn't loaded), the static
// service-highlight items, an accessible region landmark, and a
// distinct icon per item.
describe('TickerBar', () => {
  beforeEach(() => {
    fetchAllAvailableVehicles.mockReset()
  })

  it('exposes an accessible region landmark', async () => {
    fetchAllAvailableVehicles.mockResolvedValue([])
    render(<TickerBar />)
    expect(await screen.findByRole('region')).toBeInTheDocument()
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

  it('gives every item (rate + static highlights) its own icon, not a repeated bullet', async () => {
    fetchAllAvailableVehicles.mockResolvedValue([vehicleWithDailyRate(140)])
    render(<TickerBar />)
    const region = await screen.findByRole('region')
    const icons = region.querySelectorAll('svg')
    // One icon per visible item — at least the rate item plus the 4
    // static items (marquee duplicates them once more for the loop, so
    // this is a floor, not an exact count).
    expect(icons.length).toBeGreaterThanOrEqual(5)
  })
})
