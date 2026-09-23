import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AboutPage } from '@/features/content/AboutPage'
import type { VehicleWithDetails } from '@/types/domain'

const fetchAllAvailableVehicles = vi.fn()
const fetchLocations = vi.fn()

vi.mock('@/features/booking/api', () => ({
  fetchAllAvailableVehicles: (...args: unknown[]) => fetchAllAvailableVehicles(...args),
  fetchLocations: (...args: unknown[]) => fetchLocations(...args),
}))

function vehicle(overrides: Partial<VehicleWithDetails> & { id: string; categoryId: string; categoryName: string }): VehicleWithDetails {
  const { categoryId, categoryName, ...rest } = overrides
  return {
    make: 'Toyota',
    model: 'Camry',
    model_year: 2024,
    transmission: 'automatic',
    seats: 5,
    plate_number: 'A12345',
    status: 'available',
    created_at: '2026-01-01T00:00:00Z',
    category_id: categoryId,
    vehicle_categories: { id: categoryId, name: categoryName, description: null, created_at: '2026-01-01T00:00:00Z' },
    vehicle_images: [],
    pricing: [],
    ...rest,
  } as unknown as VehicleWithDetails
}

function renderIt() {
  return render(
    <MemoryRouter>
      <AboutPage />
    </MemoryRouter>,
  )
}

describe('AboutPage', () => {
  beforeEach(() => {
    fetchAllAvailableVehicles.mockReset().mockImplementation(() => new Promise(() => {}))
    fetchLocations.mockReset().mockImplementation(() => new Promise(() => {}))
  })

  it('renders the editorial hero, real story, and all four principles', () => {
    renderIt()

    expect(screen.getByRole('heading', { level: 1, name: 'Your journey should feel effortless from the first mile.' })).toBeInTheDocument()
    expect(screen.getByText(/Bliss Rent was created to solve one specific problem/)).toBeInTheDocument()
    expect(screen.getByText('Transparency')).toBeInTheDocument()
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('04')).toBeInTheDocument()
  })

  it('has no stats strip under the hero, even once data resolves — the live figures live in the "at a glance" profile', async () => {
    fetchAllAvailableVehicles.mockResolvedValue([
      vehicle({ id: 'v1', categoryId: 'cat-eco', categoryName: 'Economy' }),
      vehicle({ id: 'v2', categoryId: 'cat-lux', categoryName: 'Luxury' }),
    ])
    fetchLocations.mockResolvedValue([
      { id: 'l1', name: 'DXB Airport', city: 'Dubai', type: 'airport', airport_code: 'DXB' },
      { id: 'l2', name: 'Abu Dhabi Downtown', city: 'Abu Dhabi', type: 'city', airport_code: null },
    ])
    renderIt()

    // The data has loaded and is shown in the company profile...
    expect(await screen.findByText('Cities: 2 · Airports: 1 · Pickup points: 2')).toBeInTheDocument()
    // ...but the hero carries no number strip of its own.
    expect(screen.queryByText('Vehicles ready to book')).not.toBeInTheDocument()
    expect(screen.queryByText('Cities served')).not.toBeInTheDocument()
    expect(screen.queryByText('Car brands')).not.toBeInTheDocument()
    expect(screen.queryByText('Airports served')).not.toBeInTheDocument()
    expect(screen.queryByText('Bliss Rent today')).not.toBeInTheDocument()
    expect(screen.queryByText('The business, at a glance')).not.toBeInTheDocument()
  })

  it('shows a real per-category fleet breakdown with a live count and deep-links to a filtered search', async () => {
    fetchAllAvailableVehicles.mockResolvedValue([
      vehicle({ id: 'v1', categoryId: 'cat-lux-1', categoryName: 'Luxury' }),
      vehicle({ id: 'v2', categoryId: 'cat-lux-1', categoryName: 'Luxury' }),
    ])
    fetchLocations.mockResolvedValue([])
    renderIt()

    const heading = await screen.findByText('Luxury')
    expect(screen.getByText('2 cars')).toBeInTheDocument()
    expect(heading.closest('a')).toHaveAttribute('href', '/search?category=cat-lux-1')
  })

  it('shows the same live coverage map as the homepage, pinned from the real locations', async () => {
    fetchAllAvailableVehicles.mockResolvedValue([])
    fetchLocations.mockResolvedValue([
      { id: 'l1', name: 'DXB Airport', city: 'Dubai', type: 'airport', country: 'United Arab Emirates' },
      { id: 'l2', name: 'Marina Hotel', city: 'Dubai', type: 'hotel', country: 'United Arab Emirates' },
    ])
    renderIt()

    await waitFor(() => expect(document.querySelector('[data-label-for="Dubai"] a')).toHaveTextContent('2 pickup points'))
    expect(screen.queryByText('Live in these cities today')).not.toBeInTheDocument()
  })

  it('links the closing CTA to real booking/browse routes', () => {
    renderIt()
    expect(screen.getAllByRole('link', { name: /book now/i }).every((link) => link.getAttribute('href') === '/search?mode=book')).toBe(true)
    expect(screen.getAllByRole('link', { name: /view fleet/i }).every((link) => link.getAttribute('href') === '/search')).toBe(true)
  })

  it('links directly to the real, established WhatsApp/email/office channels — never new ones invented for this page', () => {
    renderIt()
    expect(screen.getByRole('link', { name: /chat on whatsapp/i })).toHaveAttribute('href', 'https://wa.me/971547820057')
    // The email and office address appear twice by design — in the "at a
    // glance" profile and again in the contact block at the bottom.
    const emailLinks = screen.getAllByRole('link', { name: /support@bliss\.rent/i })
    expect(emailLinks.length).toBeGreaterThanOrEqual(1)
    expect(emailLinks.every((link) => link.getAttribute('href') === 'mailto:support@bliss.rent')).toBe(true)
    expect(screen.getAllByText(/Sajaya 7 Building/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('link', { name: /full contact details/i })).toHaveAttribute('href', '/contact')
  })

  it('shows the company-profile ledger: fixed business facts always, live coverage and fleet figures once they resolve', async () => {
    const first = renderIt()
    expect(screen.getByText('Bliss Rent at a glance')).toBeInTheDocument()
    expect(screen.getByText('Self-drive car rental, booked entirely online')).toBeInTheDocument()
    expect(screen.getByText('Daily, weekly, monthly and 3-month')).toBeInTheDocument()
    expect(screen.getByText('On this website only — no account needed')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /\+971 54 782 0057/ })).toHaveAttribute('href', 'https://wa.me/971547820057')
    // Nothing live is invented before the data arrives.
    expect(screen.queryByText(/Cities: \d/)).not.toBeInTheDocument()
    first.unmount()

    fetchAllAvailableVehicles.mockResolvedValue([
      vehicle({ id: 'v1', categoryId: 'cat-eco', categoryName: 'Economy', make: 'Toyota' }),
      vehicle({ id: 'v2', categoryId: 'cat-lux', categoryName: 'Luxury', make: 'Ferrari' }),
    ])
    fetchLocations.mockResolvedValue([
      { id: 'l1', name: 'DXB Airport — Terminal 1', city: 'Dubai', type: 'airport', airport_code: 'DXB' },
      { id: 'l2', name: 'DXB Airport — Terminal 3', city: 'Dubai', type: 'airport', airport_code: 'DXB' },
      { id: 'l3', name: 'Sharjah City Centre', city: 'Sharjah', type: 'city', airport_code: null },
    ])
    renderIt()

    // Two terminals of one airport count as one airport; three points in total.
    expect(await screen.findByText('Cities: 2 · Airports: 1 · Pickup points: 3')).toBeInTheDocument()
    expect(screen.getByText('Vehicles: 2 · Brands: 2 · Categories: 2')).toBeInTheDocument()
  })

  it('explains the service model, the four booking steps and what to bring to pickup', () => {
    renderIt()
    expect(screen.getByText('How Bliss Rent works')).toBeInTheDocument()
    expect(screen.getByText('Online-only booking')).toBeInTheDocument()
    expect(screen.getByText('Self-drive, always')).toBeInTheDocument()
    // Booking steps come from the same copy the homepage's "How it works" uses.
    expect(screen.getByText('Choose dates & location')).toBeInTheDocument()
    expect(screen.getByText('Complete your booking')).toBeInTheDocument()
    expect(screen.getByText('For UAE Residents')).toBeInTheDocument()
    expect(screen.getByText('For Visitors to the UAE')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Read the FAQs' })).toHaveAttribute('href', '/faqs')
  })

  it('adds real fleet specs and the brands actually in the live fleet under the category cards', async () => {
    fetchAllAvailableVehicles.mockResolvedValue([
      vehicle({ id: 'v1', categoryId: 'cat-eco', categoryName: 'Economy', make: 'Toyota', model_year: 2023, seats: 5 }),
      vehicle({ id: 'v2', categoryId: 'cat-lux', categoryName: 'Luxury', make: 'Ferrari', model_year: 2024, seats: 2 }),
    ])
    fetchLocations.mockResolvedValue([])
    renderIt()

    expect(await screen.findByText('Brands you can drive')).toBeInTheDocument()
    expect(screen.getByText('2023–2024')).toBeInTheDocument()
    expect(screen.getByText('2–5')).toBeInTheDocument()
    expect(screen.getByText('Automatic')).toBeInTheDocument()
    expect(screen.getByText('Ferrari')).toBeInTheDocument()
    expect(screen.getByText('Toyota')).toBeInTheDocument()
  })

  it('lists every live city with its real points grouped by type, and links to the city guide', async () => {
    fetchAllAvailableVehicles.mockResolvedValue([])
    fetchLocations.mockResolvedValue([
      { id: 'l1', name: 'DXB Airport — Terminal 1', city: 'Dubai', type: 'airport', airport_code: 'DXB', country: 'United Arab Emirates' },
      { id: 'l2', name: 'Dubai — Hotel Delivery (Marina)', city: 'Dubai', type: 'hotel', airport_code: null, country: 'United Arab Emirates' },
      { id: 'l3', name: 'Sharjah City Centre', city: 'Sharjah', type: 'city', airport_code: null, country: 'United Arab Emirates' },
    ])
    renderIt()

    await screen.findByText('Every city, airport and pickup point')
    const dubai = screen.getByRole('heading', { level: 3, name: 'Dubai' }).closest('article') as HTMLElement
    expect(within(dubai).getByText('DXB Airport — Terminal 1')).toBeInTheDocument()
    expect(within(dubai).getByText('Dubai — Hotel Delivery (Marina)')).toBeInTheDocument()
    expect(within(dubai).getByText('Airport pickup')).toBeInTheDocument()
    expect(within(dubai).getByText('Hotel / accommodation delivery')).toBeInTheDocument()
    expect(within(dubai).getByRole('link', { name: /view city guide/i })).toHaveAttribute('href', '/locations/dubai')

    const sharjah = screen.getByRole('heading', { level: 3, name: 'Sharjah' }).closest('article') as HTMLElement
    expect(within(sharjah).getByText('Sharjah City Centre')).toBeInTheDocument()
    expect(within(sharjah).queryByText('Airport pickup')).not.toBeInTheDocument()
    expect(within(sharjah).getByRole('link', { name: /view city guide/i })).toHaveAttribute('href', '/locations/sharjah')
  })
})
