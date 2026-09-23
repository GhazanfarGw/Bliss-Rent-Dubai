import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SearchResultsPage } from '@/features/booking/SearchResultsPage'
import { fetchAllAvailableVehicles, fetchLocations, searchVehiclesWithAvailability } from '@/features/booking/api'
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

const rail = () => within(screen.getByRole('complementary', { name: 'Filter fleet' }))
const chips = () => within(screen.getByRole('navigation', { name: 'Browse fleet categories' }))

function priced(rate: number) {
  return [{ id: 'p', vehicle_id: 'x', term: 'daily', list_price: rate, client_price: rate, currency: 'AED', created_at: '2026-01-01T00:00:00Z' }] as never
}

describe('SearchResultsPage', () => {
  beforeEach(() => {
    vi.mocked(fetchLocations).mockReset().mockResolvedValue([])
    vi.mocked(fetchAllAvailableVehicles)
      .mockReset()
      .mockResolvedValue([
        vehicle({ id: 'v1', categoryId: 'cat-eco', categoryName: 'Economy', make: 'Toyota', model: 'Yaris', seats: 4, pricing: priced(150) }),
        vehicle({ id: 'v2', categoryId: 'cat-lux', categoryName: 'Luxury', make: 'Mercedes-Benz', model: 'S-Class', seats: 5, pricing: priced(900) }),
        vehicle({ id: 'v3', categoryId: 'cat-lux', categoryName: 'Luxury', make: 'Bentley', model: 'Continental GT', seats: 4, pricing: priced(1200) }),
      ])
    vi.mocked(searchVehiclesWithAvailability).mockReset().mockResolvedValue([])
  })

  it('pre-selects the category from a ?category= deep-link (e.g. from CarTypesPage)', async () => {
    renderAt('/search?category=cat-lux')

    await waitFor(() => expect(screen.getByText('Mercedes-Benz S-Class')).toBeInTheDocument())
    // Only the Luxury-category vehicles should render — Economy is filtered out.
    expect(screen.queryByText('Toyota Yaris')).not.toBeInTheDocument()
    expect(chips().getByRole('button', { name: /^Luxury/ })).toHaveAttribute('aria-pressed', 'true')
    expect(rail().getByRole('button', { name: /^Luxury/ })).toHaveAttribute('aria-pressed', 'true')
    expect(chips().getByRole('button', { name: /^All cars/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('browses the full unfiltered fleet with no ?category= param', async () => {
    renderAt('/search')

    await waitFor(() => expect(screen.getByText('Toyota Yaris')).toBeInTheDocument())
    expect(screen.getByText('Mercedes-Benz S-Class')).toBeInTheDocument()
    expect(chips().getByRole('button', { name: /^All cars/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows how many cars each category holds', async () => {
    renderAt('/search')

    await waitFor(() => expect(screen.getByText('Toyota Yaris')).toBeInTheDocument())
    expect(chips().getByRole('button', { name: 'All cars 3' })).toBeInTheDocument()
    expect(chips().getByRole('button', { name: 'Luxury 2' })).toBeInTheDocument()
    expect(chips().getByRole('button', { name: 'Economy 1' })).toBeInTheDocument()
  })

  it('narrows the grid when a category is picked', async () => {
    const user = userEvent.setup()
    renderAt('/search')

    await waitFor(() => expect(screen.getByText('Toyota Yaris')).toBeInTheDocument())
    await user.click(chips().getByRole('button', { name: 'Economy 1' }))

    expect(screen.getByText('Toyota Yaris')).toBeInTheDocument()
    expect(screen.queryByText('Mercedes-Benz S-Class')).not.toBeInTheDocument()
    expect(screen.getByText('1 car available')).toBeInTheDocument()
  })

  it('filters by brand from the rail, shows it as a removable chip, and updates the other counts', async () => {
    const user = userEvent.setup()
    renderAt('/search')

    await waitFor(() => expect(screen.getByText('Toyota Yaris')).toBeInTheDocument())
    await user.click(rail().getByRole('checkbox', { name: /Bentley/ }))

    expect(screen.getByText('Bentley Continental GT')).toBeInTheDocument()
    expect(screen.queryByText('Toyota Yaris')).not.toBeInTheDocument()
    expect(screen.getByText('1 car available')).toBeInTheDocument()
    // Category counts now follow the brand choice: only one Luxury car is a Bentley.
    expect(rail().getByRole('button', { name: /^Luxury/ })).toHaveTextContent('1')

    await user.click(screen.getByRole('button', { name: 'Remove Bentley' }))
    expect(screen.getByText('Toyota Yaris')).toBeInTheDocument()
    expect(screen.getByText('3 cars available')).toBeInTheDocument()
  })

  it('filters by per-day price and by minimum seats', async () => {
    const user = userEvent.setup()
    renderAt('/search')

    await waitFor(() => expect(screen.getByText('Toyota Yaris')).toBeInTheDocument())
    fireEvent.change(rail().getByLabelText('Min'), { target: { value: '500' } })
    expect(screen.queryByText('Toyota Yaris')).not.toBeInTheDocument()
    expect(screen.getByText('2 cars available')).toBeInTheDocument()

    await user.click(within(rail().getByRole('group', { name: 'Seats' })).getByRole('button', { name: '5+' }))
    expect(screen.getByText('Mercedes-Benz S-Class')).toBeInTheDocument()
    expect(screen.queryByText('Bentley Continental GT')).not.toBeInTheDocument()
    expect(screen.getByText('1 car available')).toBeInTheDocument()
  })

  it('lets the empty result state clear every filter', async () => {
    const user = userEvent.setup()
    renderAt('/search')

    await waitFor(() => expect(screen.getByText('Toyota Yaris')).toBeInTheDocument())
    fireEvent.change(rail().getByLabelText('Min'), { target: { value: '5000' } })
    expect(screen.getByText(/no cars available/i)).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1)!)
    expect(screen.getByText('3 cars available')).toBeInTheDocument()
  })

  it('opens with no hero copy and no search form — only a prompt to add dates', async () => {
    renderAt('/search')

    await waitFor(() => expect(screen.getByText('Toyota Yaris')).toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 1, name: 'Available vehicles' })).toBeInTheDocument()
    expect(screen.queryByText(/find the car that fits/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Search Cars' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Your trip' })).getByRole('button', { name: 'Add your dates' })).toBeInTheDocument()
  })

  it('reveals the search form, in a dialog, only when asked', async () => {
    const user = userEvent.setup()
    renderAt('/search')

    await waitFor(() => expect(screen.getByText('Toyota Yaris')).toBeInTheDocument())
    await user.click(within(screen.getByRole('region', { name: 'Your trip' })).getByRole('button', { name: 'Add your dates' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Add your dates' }))
    expect(dialog.getByRole('button', { name: 'Search Cars' })).toBeInTheDocument()

    await user.click(dialog.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('auto-opens the search dialog for ?mode=book — the single entry point every global Book Now CTA lands on', async () => {
    renderAt('/search?mode=book')

    await waitFor(() => expect(screen.getByText('Toyota Yaris')).toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Add your dates' })).toBeInTheDocument()
  })

  it('drops mode=book from the URL once it has opened the dialog, so a later back-navigation does not reopen it', async () => {
    function SearchWithLocationMarker() {
      const location = useLocation()
      return (
        <>
          <SearchResultsPage />
          <p data-testid="location-search">{location.search}</p>
        </>
      )
    }
    render(
      <MemoryRouter initialEntries={['/search?mode=book']}>
        <Routes>
          <Route path="/search" element={<SearchWithLocationMarker />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent(''))
  })

  describe('with a dated search', () => {
    const datedPath = '/search?start=2099-01-10&end=2099-01-12&pickup=loc-a&dropoff=loc-b&ptime=14:30'

    beforeEach(() => {
      vi.mocked(fetchLocations).mockResolvedValue([
        { id: 'loc-a', name: 'Dubai Airport T3' },
        { id: 'loc-b', name: 'Downtown Dubai' },
      ] as never)
      vi.mocked(searchVehiclesWithAvailability).mockResolvedValue([
        { ...vehicle({ id: 'v1', categoryId: 'cat-eco', categoryName: 'Economy', make: 'Toyota', model: 'Yaris' }), isAvailable: true },
      ] as never)
    })

    it('keeps the whole trip in the side column — pickup, return, dates, time and length — and offers the availability filter', async () => {
      renderAt(datedPath)

      await waitFor(() => expect(screen.getByText('Toyota Yaris')).toBeInTheDocument())
      const trip = within(screen.getByRole('region', { name: 'Your trip' }))
      await waitFor(() => expect(trip.getByText('Dubai Airport T3')).toBeInTheDocument())
      expect(trip.getByText('Downtown Dubai')).toBeInTheDocument()
      expect(trip.getByText(/2:30 PM/)).toBeInTheDocument()
      expect(trip.getByText('3 days')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Search Cars' })).not.toBeInTheDocument()
      expect(rail().getByRole('group', { name: 'Availability' })).toBeInTheDocument()
    })

    it('carries the same trip on a compact pill for phones', async () => {
      renderAt(datedPath)

      await waitFor(() => expect(screen.getByText('Toyota Yaris')).toBeInTheDocument())
      const pill = screen.getByRole('button', { name: /3 days/ })
      await waitFor(() => expect(pill).toHaveTextContent('Dubai Airport T3'))
      expect(pill).toHaveTextContent('Downtown Dubai')
    })

    it('opens the editor prefilled from the Edit link', async () => {
      const user = userEvent.setup()
      renderAt(datedPath)

      await waitFor(() => expect(screen.getByText('Toyota Yaris')).toBeInTheDocument())
      await user.click(within(screen.getByRole('region', { name: 'Your trip' })).getByRole('button', { name: 'Edit search' }))

      expect(within(screen.getByRole('dialog', { name: 'Edit search' })).getByRole('button', { name: 'Search Cars' })).toBeInTheDocument()
    })

    it('still shows the trip, so it can be edited, when no car is free for those dates', async () => {
      vi.mocked(searchVehiclesWithAvailability).mockResolvedValue([])
      renderAt(datedPath)

      await waitFor(() => expect(screen.getByText('No cars available for these dates')).toBeInTheDocument())
      const trip = within(screen.getByRole('region', { name: 'Your trip' }))
      await waitFor(() => expect(trip.getByText('Downtown Dubai')).toBeInTheDocument())
      expect(trip.getByRole('button', { name: 'Edit search' })).toBeInTheDocument()
      expect(screen.queryByRole('complementary', { name: 'Filter fleet' })).not.toBeInTheDocument()
    })
  })
})
