import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { VehicleDetailPage } from '@/features/booking/VehicleDetailPage'
import { fetchAllAvailableVehicles, fetchLocations, fetchVehicleById, isVehicleAvailable } from '@/features/booking/api'
import type { VehicleWithDetails } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchVehicleById: vi.fn(),
  fetchAllAvailableVehicles: vi.fn(),
  fetchLocations: vi.fn(),
  isVehicleAvailable: vi.fn(),
  BookingApiError: class BookingApiError extends Error {},
}))

// The real trip form is covered by its own tests; here it is a single button that
// "submits" a fixed trip, so these tests are about what the page does with the result.
vi.mock('@/features/booking/SearchWidget', () => ({
  SearchWidget: ({ onSearch, submitLabel }: { onSearch: (criteria: unknown) => void; submitLabel?: string }) => (
    <button
      type="button"
      onClick={() =>
        onSearch({ startDate: '2099-03-01', endDate: '2099-03-04', pickupLocationId: 'loc-a', dropoffLocationId: 'loc-b', pickupTime: '10:00' })
      }
    >
      {submitLabel}
    </button>
  ),
}))

function car(overrides: Partial<VehicleWithDetails> & { id: string }): VehicleWithDetails {
  return {
    category_id: 'cat-lux',
    make: 'Mercedes-Benz',
    model: 'S580',
    model_year: 2024,
    transmission: 'automatic',
    seats: 5,
    plate_number: 'A1',
    status: 'available',
    is_master_listing: true,
    master_vehicle_id: null,
    engine: null,
    horsepower: null,
    torque_nm: null,
    top_speed_kmh: null,
    acceleration_0_100: null,
    fuel_type: null,
    fuel_consumption_l100km: null,
    drivetrain: null,
    doors: null,
    origin_country: null,
    about: null,
    about_ar: null,
    vehicle_categories: { id: 'cat-lux', name: 'Luxury', description: 'Flagship luxury cars.', created_at: '' },
    vehicle_images: [],
    pricing: [{ id: 'p1', vehicle_id: overrides.id, term: 'daily', list_price: 1900, client_price: 1850, currency: 'AED', created_at: '' }],
    ...overrides,
  } as unknown as VehicleWithDetails
}

const main = car({ id: 'veh-1' })
const sibling = car({ id: 'veh-2', make: 'Bentley', model: 'Continental GT' })

function CheckoutStub() {
  const location = useLocation()
  return <p>CHECKOUT {location.pathname}{location.search}</p>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
        <Route path="/checkout/:id/customer" element={<CheckoutStub />} />
        <Route path="/search" element={<p>SEARCH {''}</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const DATED = '/vehicles/veh-1?start=2099-01-10&end=2099-01-12&pickup=loc-a&dropoff=loc-b&ptime=10:00'

describe('VehicleDetailPage — booking flow', () => {
  beforeEach(() => {
    vi.mocked(fetchVehicleById).mockReset().mockResolvedValue(main)
    vi.mocked(fetchAllAvailableVehicles).mockReset().mockResolvedValue([main, sibling])
    vi.mocked(fetchLocations)
      .mockReset()
      .mockResolvedValue([
        { id: 'loc-a', name: 'Dubai Airport T3', type: 'airport', airport_code: 'DXB' },
        { id: 'loc-b', name: 'Downtown Dubai', type: 'city' },
      ] as never)
    vi.mocked(isVehicleAvailable).mockReset().mockResolvedValue(true)
  })

  it('has one clear Book now button and none of the old "Not selected" rows', async () => {
    renderAt('/vehicles/veh-1')

    expect(await screen.findByRole('heading', { level: 1, name: 'Mercedes-Benz S580' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Book now' })).toBeEnabled()
    expect(screen.getByText('1,850')).toBeInTheDocument()
    expect(screen.queryByText('Not selected')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Continue Booking$/i })).not.toBeInTheDocument()
    // The category blurb and the spec grid are not repeated in the booking panel.
    expect(screen.queryByText('Flagship luxury cars.')).not.toBeInTheDocument()
  })

  it('opens the trip popup from Book now, and confirming a free car goes straight to the booking steps', async () => {
    const user = userEvent.setup()
    renderAt('/vehicles/veh-1')

    await user.click(await screen.findByRole('button', { name: 'Book now' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Set your trip details' }))

    await user.click(dialog.getByRole('button', { name: 'Confirm & continue' }))

    await waitFor(() => expect(screen.getByText(/^CHECKOUT \/checkout\/veh-1\/customer\?/)).toBeInTheDocument())
    expect(isVehicleAvailable).toHaveBeenCalledWith('veh-1', '2099-03-01', '2099-03-04')
    const shown = screen.getByText(/^CHECKOUT/).textContent ?? ''
    expect(shown).toContain('start=2099-03-01')
    expect(shown).toContain('end=2099-03-04')
    expect(shown).toContain('pickup=loc-a')
    expect(shown).toContain('dropoff=loc-b')
  })

  it('keeps the popup open with a clear message when the car is not free for the dates picked', async () => {
    vi.mocked(isVehicleAvailable).mockResolvedValue(false)
    const user = userEvent.setup()
    renderAt('/vehicles/veh-1')

    await user.click(await screen.findByRole('button', { name: 'Book now' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm & continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This car is not available for those dates')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText(/^CHECKOUT/)).not.toBeInTheDocument()
  })

  it('does not let a failed availability check through', async () => {
    vi.mocked(isVehicleAvailable).mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    renderAt('/vehicles/veh-1')

    await user.click(await screen.findByRole('button', { name: 'Book now' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm & continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't check availability")
    expect(screen.queryByText(/^CHECKOUT/)).not.toBeInTheDocument()
  })

  it('summarises a chosen trip in one short block, and Book now then skips the popup for a free car', async () => {
    const user = userEvent.setup()
    renderAt(DATED)

    expect(await screen.findByText('Jan 10 – Jan 12, 2099 · 3 days')).toBeInTheDocument()
    expect(await screen.findByText('Dubai Airport T3 → Downtown Dubai')).toBeInTheDocument()
    expect(await screen.findByText('Airport pickup — DXB')).toBeInTheDocument()
    // Scoped to the booking panel: the similar-cars row below has its own "Available" badges.
    const panel = within(screen.getByRole('heading', { level: 1 }).closest('section') as HTMLElement)
    await waitFor(() => expect(panel.getByText('Available')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Book now' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/^CHECKOUT \/checkout\/veh-1\/customer\?/)).toBeInTheDocument())
    expect(screen.getByText(/^CHECKOUT/).textContent).toContain('start=2099-01-10')
  })

  it('offers "Change dates" instead of Book now when the car is taken, and it opens the popup', async () => {
    vi.mocked(isVehicleAvailable).mockResolvedValue(false)
    const user = userEvent.setup()
    renderAt(DATED)

    expect(await screen.findByText('Not available for these dates')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Book now' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Change dates' }))
    expect(screen.getByRole('dialog', { name: 'Set your trip details' })).toBeInTheDocument()
  })

  it('reopens the same popup from the Edit link', async () => {
    const user = userEvent.setup()
    renderAt(DATED)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('dialog', { name: 'Set your trip details' })).toBeInTheDocument()
  })
})

describe('VehicleDetailPage — more vehicles in the category', () => {
  beforeEach(() => {
    vi.mocked(fetchVehicleById).mockReset().mockResolvedValue(main)
    vi.mocked(fetchAllAvailableVehicles).mockReset().mockResolvedValue([main, sibling])
    vi.mocked(fetchLocations).mockReset().mockResolvedValue([])
    vi.mocked(isVehicleAvailable).mockReset().mockResolvedValue(true)
  })

  it('shows the other cars of the category under a simple heading, with a View all link to that category', async () => {
    renderAt('/vehicles/veh-1?start=2099-01-10&end=2099-01-12&pickup=loc-a&dropoff=loc-b')

    expect(await screen.findByRole('heading', { level: 2, name: 'More Luxury vehicles' })).toBeInTheDocument()
    expect(await screen.findByText('Bentley Continental GT')).toBeInTheDocument()
    // The car being viewed is not offered again.
    expect(screen.getAllByText('Mercedes-Benz S580').length).toBe(1) // only the page's own heading

    const viewAll = screen.getByRole('link', { name: 'View all' })
    const href = viewAll.getAttribute('href') ?? ''
    expect(href.startsWith('/search?')).toBe(true)
    expect(href).toContain('category=cat-lux')
    // Dates already chosen travel with the link.
    expect(href).toContain('start=2099-01-10')
  })

  it('shows no such section when there are no other cars', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([main])
    renderAt('/vehicles/veh-1')

    await screen.findByRole('heading', { level: 1, name: 'Mercedes-Benz S580' })
    await waitFor(() => expect(fetchAllAvailableVehicles).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { name: /^More Luxury vehicles$/ })).not.toBeInTheDocument()
  })
})
