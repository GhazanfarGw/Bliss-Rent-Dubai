import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SearchResultsPage } from '@/features/booking/SearchResultsPage'
import { fetchAllAvailableVehicles, fetchLocations } from '@/features/booking/api'
import type { VehicleWithDetails } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchAllAvailableVehicles: vi.fn(),
  fetchLocations: vi.fn(),
  searchVehiclesWithAvailability: vi.fn(),
  BookingApiError: class BookingApiError extends Error {},
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
    vehicle_images: [
      { id: `img-${rest.id}`, vehicle_id: rest.id, storage_path: `fleet/${rest.id}.webp`, is_primary: true, sort_order: 0, created_at: '2026-01-01T00:00:00Z' },
    ],
    pricing: [{ id: 'p1', vehicle_id: rest.id, term: 'daily', list_price: 150, client_price: 150, currency: 'AED', created_at: '2026-01-01T00:00:00Z' }],
    ...rest,
  } as unknown as VehicleWithDetails
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/search" element={<SearchResultsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SearchResultsPage — category deep-link', () => {
  beforeEach(() => {
    vi.mocked(fetchLocations).mockReset().mockResolvedValue([])
    vi.mocked(fetchAllAvailableVehicles)
      .mockReset()
      .mockResolvedValue([
        vehicle({ id: 'v1', categoryId: 'cat-eco', categoryName: 'Economy', make: 'Toyota', model: 'Yaris' }),
        vehicle({ id: 'v2', categoryId: 'cat-lux', categoryName: 'Luxury', make: 'Mercedes-Benz', model: 'S-Class' }),
      ])
  })

  it('pre-selects the category filter from a ?category= deep-link (e.g. from CarTypesPage)', async () => {
    renderAt('/search?category=cat-lux')

    await waitFor(() => expect(screen.getByText('Mercedes-Benz S-Class')).toBeInTheDocument())
    // Only the Luxury-category vehicle should render — Economy is filtered out.
    expect(screen.queryByText('Toyota Yaris')).not.toBeInTheDocument()
    const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement
    expect(categorySelect.value).toBe('cat-lux')
  })

  it('browses the full unfiltered fleet with no ?category= param', async () => {
    renderAt('/search')

    await waitFor(() => expect(screen.getByText('Toyota Yaris')).toBeInTheDocument())
    expect(screen.getByText('Mercedes-Benz S-Class')).toBeInTheDocument()
    const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement
    expect(categorySelect.value).toBe('')
  })
})
