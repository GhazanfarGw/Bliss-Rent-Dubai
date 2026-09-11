import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FeaturedVehicles } from '@/features/booking/FeaturedVehicles'
import { fetchFeaturedVehiclesByCategory } from '@/features/booking/api'
import type { VehicleWithDetails } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchFeaturedVehiclesByCategory: vi.fn(),
}))

const economyVehicle: VehicleWithDetails = {
  id: 'veh-eco-1',
  category_id: 'cat-eco',
  make: 'Toyota',
  model: 'Camry',
  model_year: 2024,
  transmission: 'automatic',
  seats: 5,
  plate_number: 'A12345',
  status: 'available',
  created_at: '2026-01-01T00:00:00Z',
  vehicle_categories: { id: 'cat-eco', name: 'Economy', description: null },
  vehicle_images: [{ id: 'img-eco-1', vehicle_id: 'veh-eco-1', storage_path: 'veh-eco-1/main.jpg', is_primary: true, sort_order: 0 }],
  pricing: [
    { id: 'p1', vehicle_id: 'veh-eco-1', term: 'daily', list_price: 200, client_price: 180, currency: 'AED' },
  ],
} as unknown as VehicleWithDetails

const luxuryVehicle: VehicleWithDetails = {
  id: 'veh-lux-1',
  category_id: 'cat-lux',
  make: 'Lamborghini',
  model: 'Huracan EVO',
  model_year: 2024,
  transmission: 'automatic',
  seats: 2,
  plate_number: 'TEMP-LUX-10',
  status: 'available',
  created_at: '2026-09-01T00:00:00Z',
  vehicle_categories: { id: 'cat-lux', name: 'Luxury', description: null },
  vehicle_images: [{ id: 'img-lux-1', vehicle_id: 'veh-lux-1', storage_path: 'veh-lux-1/main.jpg', is_primary: true, sort_order: 0 }],
  pricing: [
    { id: 'p2', vehicle_id: 'veh-lux-1', term: 'daily', list_price: 7000, client_price: 5350, currency: 'AED' },
  ],
} as unknown as VehicleWithDetails

function mockByCategory(vehiclesByCategory: Record<string, VehicleWithDetails[]>) {
  vi.mocked(fetchFeaturedVehiclesByCategory).mockImplementation(async (categoryName: string) => vehiclesByCategory[categoryName] ?? [])
}

function renderIt() {
  return render(
    <MemoryRouter>
      <FeaturedVehicles />
    </MemoryRouter>,
  )
}

describe('FeaturedVehicles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a professional empty state for each category when no vehicles exist — never fake data', async () => {
    mockByCategory({})
    renderIt()

    expect(await screen.findByText('No economy vehicles listed yet')).toBeInTheDocument()
    expect(screen.getByText('No luxury vehicles listed yet')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /view details/i })).not.toBeInTheDocument()
  })

  it('renders Economy and Luxury vehicles in their own separate auto-scrolling rows, never merged together', async () => {
    mockByCategory({ Economy: [economyVehicle], Luxury: [luxuryVehicle] })
    renderIt()

    const camryCards = await screen.findAllByText('Toyota Camry')
    const huracanCards = await screen.findAllByText('Lamborghini Huracan EVO')
    // Each real vehicle renders twice — the row is duplicated once so the
    // auto-scroll loop is seamless.
    expect(camryCards).toHaveLength(2)
    expect(huracanCards).toHaveLength(2)

    // One shared heading for the whole section — each row only gets a
    // small label, not its own heading+description (per-card vehicle
    // names are their own, unrelated h3s inside VehicleCard).
    expect(screen.getByRole('heading', { name: 'Featured vehicles' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Featured Economy Vehicles' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Featured Luxury Fleet' })).not.toBeInTheDocument()
    expect(screen.getByText('Economy Fleet')).toBeInTheDocument()
    expect(screen.getByText('Luxury Fleet')).toBeInTheDocument()

    // Each slider is its own scroll container — a merged single row would
    // only have one .overflow-hidden ancestor shared by both vehicles.
    const camryScroller = camryCards[0].closest('.overflow-hidden')
    const huracanScroller = huracanCards[0].closest('.overflow-hidden')
    expect(camryScroller).not.toBeNull()
    expect(huracanScroller).not.toBeNull()
    expect(camryScroller).not.toBe(huracanScroller)
  })

  it('hides the duplicated (loop-only) copy of each card from screen readers and keyboard tabbing', async () => {
    mockByCategory({ Economy: [economyVehicle], Luxury: [] })
    renderIt()

    const camryCards = await screen.findAllByText('Toyota Camry')
    expect(camryCards).toHaveLength(2)

    const wrappers = camryCards.map((card) => card.closest('[aria-hidden], .w-\\[82vw\\]'))
    const hiddenCount = wrappers.filter((el) => el?.getAttribute('aria-hidden') === 'true').length
    expect(hiddenCount).toBe(1)
  })

  it('scrolls the Economy row and the Luxury row in opposite directions', async () => {
    mockByCategory({ Economy: [economyVehicle], Luxury: [luxuryVehicle] })
    renderIt()

    await screen.findAllByText('Toyota Camry')

    expect(document.querySelector('.animate-featured-marquee-right')).not.toBeNull()
    expect(document.querySelector('.animate-featured-marquee-left')).not.toBeNull()
  })

  it('fetches each category independently by name', async () => {
    mockByCategory({ Economy: [economyVehicle], Luxury: [luxuryVehicle] })
    renderIt()

    await screen.findAllByText('Toyota Camry')

    expect(fetchFeaturedVehiclesByCategory).toHaveBeenCalledWith('Economy')
    expect(fetchFeaturedVehiclesByCategory).toHaveBeenCalledWith('Luxury')
  })

  it('shows the empty state for a category (not a crash) if its fetch fails', async () => {
    vi.mocked(fetchFeaturedVehiclesByCategory).mockImplementation(async (categoryName: string) => {
      if (categoryName === 'Luxury') throw new Error('network down')
      return []
    })
    renderIt()

    expect(await screen.findByText('No economy vehicles listed yet')).toBeInTheDocument()
    expect(await screen.findByText('No luxury vehicles listed yet')).toBeInTheDocument()
  })
})
