import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { VehicleCategoriesSection } from '@/features/booking/VehicleCategoriesSection'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import type { VehicleWithDetails } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchAllAvailableVehicles: vi.fn(),
}))

function vehicle(overrides: Partial<VehicleWithDetails> & { categoryId: string; categoryName: string }): VehicleWithDetails {
  const { categoryId, categoryName, ...rest } = overrides
  return {
    id: 'veh-1',
    category_id: categoryId,
    make: 'Toyota',
    model: 'Camry',
    model_year: 2024,
    transmission: 'automatic',
    seats: 5,
    plate_number: 'A12345',
    status: 'available',
    created_at: '2026-01-01T00:00:00Z',
    vehicle_categories: { id: categoryId, name: categoryName, description: null },
    vehicle_images: [],
    pricing: [],
    ...rest,
  } as unknown as VehicleWithDetails
}

function renderIt() {
  return render(
    <MemoryRouter>
      <VehicleCategoriesSection />
    </MemoryRouter>,
  )
}

describe('VehicleCategoriesSection', () => {
  beforeEach(() => {
    vi.mocked(fetchAllAvailableVehicles).mockReset()
  })

  it('shows a live, real available-count per category — never an invented number', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([
      vehicle({ id: 'v1', categoryId: 'cat-eco', categoryName: 'Economy' }),
      vehicle({ id: 'v2', categoryId: 'cat-eco', categoryName: 'Economy' }),
      vehicle({ id: 'v3', categoryId: 'cat-lux', categoryName: 'Luxury' }),
    ])
    renderIt()

    expect(await screen.findByText('Economy')).toBeInTheDocument()
    expect(screen.getByText('2 cars available')).toBeInTheDocument()
    expect(screen.getByText('Luxury')).toBeInTheDocument()
    expect(screen.getByText('1 car available')).toBeInTheDocument()
  })

  it('uses a real photo from one of the category’s available vehicles when one has an image', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([
      vehicle({
        id: 'v1',
        categoryId: 'cat-suv',
        categoryName: 'SUV',
        vehicle_images: [
          { id: 'img1', vehicle_id: 'v1', storage_path: 'fleet/suv-1.webp', is_primary: true, sort_order: 0, created_at: '2026-01-01T00:00:00Z' },
        ],
      }),
    ])
    renderIt()

    const img = await screen.findByAltText('SUV')
    expect(img.tagName).toBe('IMG')
    expect(img.getAttribute('src')).toContain('suv-1.webp')
  })

  it('links every category card to the fleet/search page', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([vehicle({ id: 'v1', categoryId: 'cat-eco', categoryName: 'Economy' })])
    renderIt()

    const link = (await screen.findByText('Economy')).closest('a')
    expect(link).toHaveAttribute('href', '/search')
  })

  it('shows a "See more" button only when there are more categories than fit the initial grid, and expands the rest on click', async () => {
    const manyCategories = Array.from({ length: 12 }, (_, i) =>
      vehicle({ id: `v${i}`, categoryId: `cat-${i}`, categoryName: `Category ${i}` }),
    )
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue(manyCategories)
    renderIt()

    await screen.findByText('Category 0')
    expect(screen.queryByText('Category 11')).not.toBeInTheDocument()
    const seeMore = screen.getByRole('button', { name: /see more/i })

    await userEvent.click(seeMore)

    expect(screen.getByText('Category 11')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /see more/i })).not.toBeInTheDocument()
  })

  it('does not show "See more" when every category already fits', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([vehicle({ id: 'v1', categoryId: 'cat-eco', categoryName: 'Economy' })])
    renderIt()

    await screen.findByText('Economy')
    expect(screen.queryByRole('button', { name: /see more/i })).not.toBeInTheDocument()
  })

  it('shows the empty state, never fabricated categories, when the live fleet has none', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([])
    renderIt()

    await waitFor(() => expect(screen.getByText('Fleet categories will appear here')).toBeInTheDocument())
  })

  it('shows the category’s real description when it has one, and nothing extra when it does not', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([
      vehicle({
        id: 'v1',
        categoryId: 'cat-lux',
        categoryName: 'Luxury',
        vehicle_categories: { id: 'cat-lux', name: 'Luxury', description: 'Top-tier comfort and performance.', created_at: '2026-01-01T00:00:00Z' },
      }),
      vehicle({ id: 'v2', categoryId: 'cat-eco', categoryName: 'Economy' }),
    ])
    renderIt()

    expect(await screen.findByText('Top-tier comfort and performance.')).toBeInTheDocument()
    // Economy's mock has description: null — its card renders no third line.
    const economyCard = (await screen.findByText('Economy')).closest('a')
    expect(economyCard?.querySelectorAll('p')).toHaveLength(1)
  })
})
