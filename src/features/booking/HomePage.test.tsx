import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from '@/features/booking/HomePage'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import type { VehicleWithDetails } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchLocations: vi.fn().mockResolvedValue([]),
  fetchFeaturedVehicles: vi.fn().mockResolvedValue([]),
  fetchAllAvailableVehicles: vi.fn().mockResolvedValue([]),
}))

function inCategory(id: string, categoryId: string, categoryName: string, make: string, model: string) {
  return {
    id,
    category_id: categoryId,
    make,
    model,
    model_year: 2024,
    transmission: 'automatic',
    seats: 4,
    status: 'available',
    created_at: '2026-01-01T00:00:00Z',
    vehicle_categories: { id: categoryId, name: categoryName, description: null },
    vehicle_images: [{ id: `img-${id}`, vehicle_id: id, storage_path: `${id}/main.jpg`, is_primary: true, sort_order: 0 }],
    pricing: [{ id: `price-${id}`, vehicle_id: id, term: 'daily', list_price: 1000, client_price: 800, currency: 'AED' }],
  } as unknown as VehicleWithDetails
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([])
  })

  it('moves from booking to fleet, editorial guides, sports cars and journey planning', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([
      inCategory('v-sports', 'cat-sports', 'Sports & Supercars', 'Ferrari', '488 Spider'),
    ])
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
    const featured = screen.getByRole('heading', { name: 'Featured vehicles' })
    const journal = screen.getByRole('heading', { name: 'The UAE, from the driver’s seat' })
    const sports = await screen.findByRole('heading', { name: 'Sports cars, built for the moment' })
    const journey = screen.getByRole('heading', { name: 'Land, collect the keys, and make the UAE yours.' })

    const order = [hero, booking as Element, featured, journal, sports, journey]
    for (let i = 0; i < order.length - 1; i++) {
      // eslint-disable-next-line no-bitwise
      expect(order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('opens every section with its small heading above the big one, with the blog slider between the map and the FAQ', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([
      inCategory('v-sports', 'cat-sports', 'Sports & Supercars', 'Ferrari', '488 Spider'),
    ])
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    // [big heading, small heading above it] in page order.
    const sections: [string, string][] = [
      ['Featured vehicles', 'Our fleet'],
      ['The UAE, from the driver’s seat', 'The Bliss journal'],
      ['Sports cars, built for the moment', 'The performance edit'],
      ['Land, collect the keys, and make the UAE yours.', 'Made for the whole UAE'],
      ['Pick up and return your car anywhere we operate', 'Pickup & drop-off'],
      ['Read up before you drive', 'The Bliss blog'],
      ['Your questions, answered', 'Need to know'],
      ['Ready for your next UAE drive?', 'Your next drive starts here'],
    ]

    const headings: Element[] = []
    for (const [title, eyebrow] of sections) {
      const heading = await screen.findByRole('heading', { name: title })
      const section = heading.closest('section') as HTMLElement
      const label = within(section).getByText(eyebrow)
      // eslint-disable-next-line no-bitwise
      expect(label.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING, `${title}: small heading first`).toBeTruthy()
      headings.push(heading)
    }
    for (let i = 0; i < headings.length - 1; i++) {
      // eslint-disable-next-line no-bitwise
      expect(headings[i].compareDocumentPosition(headings[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING, sections[i][0]).toBeTruthy()
    }
  })

  it('closes with the same plain Book Now / View fleet band as the Contact and About pages', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    const heading = await screen.findByRole('heading', { name: 'Ready for your next UAE drive?' })
    const section = heading.closest('section') as HTMLElement
    expect(within(section).getByRole('link', { name: 'Book Now' })).toHaveAttribute('href', '/book')
    expect(within(section).getByRole('link', { name: 'View fleet' })).toHaveAttribute('href', '/search')
  })

  it('links to blog guides from the homepage', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    const heading = await screen.findByRole('heading', { name: 'The UAE, from the driver’s seat' })
    const section = heading.closest('section') as HTMLElement
    expect(within(section).getByRole('link', { name: /Car Rental in Dubai: The Complete Guide/i })).toHaveAttribute('href', '/blog/car-rental-dubai-complete-guide')
    expect(within(section).getByRole('link', { name: 'View all articles' })).toHaveAttribute('href', '/blog')
  })

  it('keeps the booking anchor and leaves detailed About-only sections off the homepage', async () => {
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: 'Drive Your Journey with Bliss Rent' })
    expect(container.querySelector('#booking-section')).not.toBeNull()
    expect(container.querySelector('#why-choose')).toBeNull()
    expect(container.querySelector('#how-it-works')).toBeNull()
  })

  it('renders an honest empty state for Featured Vehicles rather than fake data when the fleet is empty', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('No vehicles listed yet')).toBeInTheDocument()
  })

  it('renders one shared Featured Vehicles heading with a tab per live category, not a heading per row', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([
      inCategory('v1', 'cat-eco', 'Economy', 'Toyota', 'Camry'),
      inCategory('v2', 'cat-sports', 'Sports & Supercars', 'Ferrari', '488 Spider'),
    ])

    try {
      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      )
      expect(await screen.findByRole('heading', { name: 'Featured vehicles' })).toBeInTheDocument()
      const group = await screen.findByRole('group', { name: 'Vehicle categories' })
      expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Sports & Supercars', 'Economy'])
      expect(screen.queryByRole('heading', { name: 'Featured Economy Vehicles' })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Featured Luxury Fleet' })).not.toBeInTheDocument()
    } finally {
      vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([])
    }
  })
})
