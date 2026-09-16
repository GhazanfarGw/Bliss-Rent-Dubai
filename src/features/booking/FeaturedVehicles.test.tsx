import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('defaults to the Economy tab and shows its empty state when no vehicles exist — never fake data', async () => {
    mockByCategory({})
    renderIt()

    expect(await screen.findByText('No economy vehicles listed yet')).toBeInTheDocument()
    expect(screen.queryByText('No luxury vehicles listed yet')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /view details/i })).not.toBeInTheDocument()
    expect(fetchFeaturedVehiclesByCategory).toHaveBeenCalledWith('Economy')
    expect(fetchFeaturedVehiclesByCategory).not.toHaveBeenCalledWith('Luxury')
  })

  it('shows only the active category\'s real vehicles in an auto-scrolling row, switching on toggle click', async () => {
    const user = userEvent.setup()
    mockByCategory({ Economy: [economyVehicle], Luxury: [luxuryVehicle] })
    renderIt()

    // Each real vehicle renders twice — the row is duplicated once so the
    // auto-scroll loop is seamless (same trick the pre-toggle version used).
    expect(await screen.findAllByText('Toyota Camry')).toHaveLength(2)
    expect(screen.queryByText('Lamborghini Huracan EVO')).not.toBeInTheDocument()

    // One shared heading for the whole section; the toggle itself uses
    // the same "Economy Fleet"/"Luxury Fleet" copy as button labels, not
    // headings.
    expect(screen.getByRole('heading', { name: 'Featured vehicles' })).toBeInTheDocument()
    const luxuryTab = screen.getByRole('button', { name: 'Luxury Fleet' })
    expect(luxuryTab).toHaveAttribute('aria-pressed', 'false')

    await user.click(luxuryTab)

    expect(await screen.findAllByText('Lamborghini Huracan EVO')).toHaveLength(2)
    expect(screen.queryByText('Toyota Camry')).not.toBeInTheDocument()
    expect(luxuryTab).toHaveAttribute('aria-pressed', 'true')
    expect(fetchFeaturedVehiclesByCategory).toHaveBeenCalledWith('Luxury')
  })

  it('auto-scrolls the active row and hides the duplicated (loop-only) copy from screen readers and keyboard tabbing', async () => {
    mockByCategory({ Economy: [economyVehicle], Luxury: [] })
    renderIt()

    const camryCards = await screen.findAllByText('Toyota Camry')
    expect(camryCards).toHaveLength(2)

    expect(document.querySelector('.animate-featured-marquee-right')).not.toBeNull()

    const wrappers = camryCards.map((card) => card.closest('[aria-hidden], .w-\\[82vw\\]'))
    const hiddenCount = wrappers.filter((el) => el?.getAttribute('aria-hidden') === 'true').length
    expect(hiddenCount).toBe(1)
  })

  it('scrolls the Economy row and the Luxury row in opposite directions', async () => {
    const user = userEvent.setup()
    mockByCategory({ Economy: [economyVehicle], Luxury: [luxuryVehicle] })
    renderIt()

    await screen.findAllByText('Toyota Camry')
    expect(document.querySelector('.animate-featured-marquee-right')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Luxury Fleet' }))

    await screen.findAllByText('Lamborghini Huracan EVO')
    expect(document.querySelector('.animate-featured-marquee-left')).not.toBeNull()
    expect(document.querySelector('.animate-featured-marquee-right')).toBeNull()
  })

  it('shows the empty state (not a crash) if the active category\'s fetch fails', async () => {
    vi.mocked(fetchFeaturedVehiclesByCategory).mockImplementation(async (categoryName: string) => {
      if (categoryName === 'Economy') throw new Error('network down')
      return []
    })
    renderIt()

    expect(await screen.findByText('No economy vehicles listed yet')).toBeInTheDocument()
  })
})
