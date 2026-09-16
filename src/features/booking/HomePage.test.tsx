import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from '@/features/booking/HomePage'

vi.mock('@/features/booking/api', () => ({
  fetchLocations: vi.fn().mockResolvedValue([]),
  fetchFeaturedVehicles: vi.fn().mockResolvedValue([]),
  fetchFeaturedVehiclesByCategory: vi.fn().mockResolvedValue([]),
  fetchAllAvailableVehicles: vi.fn().mockResolvedValue([]),
}))

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the hero, booking search, featured vehicles, why-choose, and how-it-works sections in order', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const hero = await screen.findByRole('heading', { name: 'Drive Your Journey with Bliss Rent' })
    // The booking widget is now embedded inside Hero itself (see Hero.tsx)
    // rather than a separate section with its own heading — assert
    // ordering against its #booking-section anchor directly instead of a
    // (no-longer-existent) "Find your car" heading.
    const booking = document.getElementById('booking-section')
    expect(booking).not.toBeNull()
    const whyChoose = screen.getByRole('heading', { name: 'Why Dubai chooses Bliss Rent' })
    const featured = screen.getByRole('heading', { name: 'Featured vehicles' })
    const howItWorks = await screen.findByRole('heading', { name: 'How it works' })

    const order = [hero, booking as Element, featured, whyChoose, howItWorks]
    for (let i = 0; i < order.length - 1; i++) {
      // eslint-disable-next-line no-bitwise
      expect(order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('gives the booking section an id="booking-section" anchor target for the hero CTA and sticky bar', async () => {
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: 'Drive Your Journey with Bliss Rent' })
    expect(container.querySelector('#booking-section')).not.toBeNull()
    expect(container.querySelector('#why-choose')).not.toBeNull()
    expect(container.querySelector('#how-it-works')).not.toBeNull()
  })

  it('renders an honest empty state for the active Featured Vehicles tab rather than fake data when none exist', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    // The Economy/Luxury toggle shows one category's real data at a
    // time (see FeaturedVehicles.tsx) — Economy is the default tab.
    expect(await screen.findByText('No economy vehicles listed yet')).toBeInTheDocument()
    expect(screen.queryByText('No luxury vehicles listed yet')).not.toBeInTheDocument()
  })

  it('renders one shared Featured Vehicles heading above the separate Economy and Luxury rows, not a heading per row', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Featured vehicles' })).toBeInTheDocument()
    expect(screen.getByText('Economy Fleet')).toBeInTheDocument()
    expect(screen.getByText('Luxury Fleet')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Featured Economy Vehicles' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Featured Luxury Fleet' })).not.toBeInTheDocument()
  })
})
