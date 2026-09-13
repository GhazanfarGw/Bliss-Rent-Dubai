import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
    fetchAllAvailableVehicles.mockReset().mockResolvedValue([])
    fetchLocations.mockReset().mockResolvedValue([])
  })

  it('renders the real title, story, and all four values with a numbered index', () => {
    renderIt()

    expect(screen.getByRole('heading', { level: 1, name: 'About Bliss Rent' })).toBeInTheDocument()
    expect(screen.getByText(/Bliss Rent was created to solve one specific problem/)).toBeInTheDocument()
    expect(screen.getByText('Transparency')).toBeInTheDocument()
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('04')).toBeInTheDocument()
  })

  it('shows the live stats strip only once real data resolves — never a fabricated number', async () => {
    const first = renderIt()
    expect(screen.queryByText('Bliss Rent today')).not.toBeInTheDocument()
    first.unmount()

    fetchAllAvailableVehicles.mockResolvedValue([
      vehicle({ id: 'v1', categoryId: 'cat-eco', categoryName: 'Economy' }),
      vehicle({ id: 'v2', categoryId: 'cat-lux', categoryName: 'Luxury' }),
    ])
    fetchLocations.mockResolvedValue([{ city: 'Dubai', type: 'airport' }, { city: 'Abu Dhabi', type: 'city' }])
    renderIt()

    await waitFor(() => expect(screen.getByText('Bliss Rent today')).toBeInTheDocument())
    expect(screen.getByText('2 vehicles ready to book')).toBeInTheDocument()
  })

  it('shows a real per-category fleet breakdown with a live count and deep-links to a filtered search', async () => {
    fetchAllAvailableVehicles.mockResolvedValue([
      vehicle({ id: 'v1', categoryId: 'cat-lux-1', categoryName: 'Luxury' }),
      vehicle({ id: 'v2', categoryId: 'cat-lux-1', categoryName: 'Luxury' }),
    ])
    renderIt()

    const heading = await screen.findByText('Luxury')
    expect(screen.getByText('2 cars')).toBeInTheDocument()
    expect(heading.closest('a')).toHaveAttribute('href', '/search?category=cat-lux-1')
  })

  it('shows real city coverage with the real location types present in each city', async () => {
    fetchLocations.mockResolvedValue([
      { city: 'Dubai', type: 'airport', country: 'United Arab Emirates' },
      { city: 'Dubai', type: 'hotel', country: 'United Arab Emirates' },
    ])
    renderIt()

    await screen.findByText('Live in these cities today')
    expect(screen.getByText('Airport pickup')).toBeInTheDocument()
    expect(screen.getByText('Hotel / accommodation delivery')).toBeInTheDocument()
    expect(screen.queryByText('Delivery')).not.toBeInTheDocument()
  })

  it('links the closing CTA to real booking/browse routes', () => {
    renderIt()
    expect(screen.getByRole('link', { name: /book now/i })).toHaveAttribute('href', '/book')
    expect(screen.getByRole('link', { name: /view fleet/i })).toHaveAttribute('href', '/search')
  })

  it('links directly to the real, established WhatsApp/email/office channels — never new ones invented for this page', () => {
    renderIt()
    expect(screen.getByRole('link', { name: /chat on whatsapp/i })).toHaveAttribute('href', 'https://wa.me/971547820057')
    expect(screen.getByRole('link', { name: /email us/i })).toHaveAttribute('href', 'mailto:support@bliss.rent')
    expect(screen.getByText(/Sajaya 7 Building/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /full contact details/i })).toHaveAttribute('href', '/contact')
  })
})
