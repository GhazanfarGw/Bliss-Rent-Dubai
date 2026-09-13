import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CarTypesPage } from '@/features/content/CarTypesPage'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import type { VehicleWithDetails } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchAllAvailableVehicles: vi.fn(),
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
    vehicle_categories: { id: categoryId, name: categoryName, description: null, created_at: '2026-01-01T00:00:00Z' },
    vehicle_images: [],
    pricing: [],
    ...rest,
  } as unknown as VehicleWithDetails
}

function renderIt() {
  return render(
    <MemoryRouter>
      <CarTypesPage />
    </MemoryRouter>,
  )
}

describe('CarTypesPage', () => {
  beforeEach(() => {
    vi.mocked(fetchAllAvailableVehicles).mockReset()
  })

  it('links each real category to a filtered search, using its real id — never a fabricated one', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([
      vehicle({ id: 'v1', categoryId: 'cat-eco-123', categoryName: 'Economy' }),
    ])
    renderIt()

    const link = (await screen.findByText('Economy')).closest('a')
    expect(link).toHaveAttribute('href', '/search?category=cat-eco-123')
  })

  it('shows a real live "from" daily rate only when a vehicle actually has one — never a hand-typed figure', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([
      vehicle({
        id: 'v1',
        categoryId: 'cat-lux',
        categoryName: 'Luxury',
        pricing: [{ id: 'p1', vehicle_id: 'v1', term: 'daily', list_price: 500, client_price: 450, currency: 'AED', created_at: '2026-01-01T00:00:00Z' }],
      }),
      vehicle({ id: 'v2', categoryId: 'cat-eco', categoryName: 'Economy' }),
    ])
    renderIt()

    expect(await screen.findByText('From AED 450/day')).toBeInTheDocument()
    // Economy has no pricing row at all — no price line renders for it.
    const economyCard = (await screen.findByText('Economy')).closest('a')
    expect(economyCard?.textContent).not.toMatch(/from/i)
  })

  it('matches a live category to its real marketing blurb by name, and renders honestly without one for an unmatched category', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([
      vehicle({ id: 'v1', categoryId: 'cat-eco', categoryName: 'Economy' }),
      vehicle({ id: 'v2', categoryId: 'cat-mystery', categoryName: 'Some New Category' }),
    ])
    renderIt()

    // Economy's real static blurb (from en.ts) should appear.
    expect(await screen.findByText(/Practical and budget-friendly/i)).toBeInTheDocument()
    // The unmatched category still renders honestly, just without a blurb.
    expect(screen.getByText('Some New Category')).toBeInTheDocument()
  })

  it('shows an empty state, never fabricated categories, when the live fleet has none', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([])
    renderIt()

    expect(await screen.findByText('Categories are being added')).toBeInTheDocument()
  })
})
