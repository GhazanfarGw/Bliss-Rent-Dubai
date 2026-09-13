import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SiteSearch } from '@/features/shared/SiteSearch'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import type { VehicleWithDetails } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchAllAvailableVehicles: vi.fn(),
}))

function vehicle(overrides: Partial<VehicleWithDetails> & { id: string }): VehicleWithDetails {
  return {
    make: 'Toyota',
    model: 'Camry',
    model_year: 2024,
    transmission: 'automatic',
    seats: 5,
    vehicle_categories: { id: 'cat-1', name: 'Sedan', description: null },
    // A public listing needs BOTH a valid image and a valid price (see
    // groupPublicVehicles/isEligibleForPublicListing) — give every fixture
    // one by default so tests exercising real match logic aren't
    // incidentally filtered out; the "no price/photo" test below overrides
    // these back out on purpose.
    vehicle_images: [{ id: 'img-1', storage_path: 'vehicles/placeholder.jpg', is_primary: true, sort_order: 0 }],
    pricing: [{ id: 'price-1', vehicle_id: overrides.id, term: 'daily', list_price: 180, client_price: 149, currency: 'AED' }],
    ...overrides,
  } as unknown as VehicleWithDetails
}

function renderIt() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SiteSearch />
      <Routes>
        <Route path="/" element={<p>Home page marker</p>} />
        <Route path="/about" element={<p>About page marker</p>} />
        <Route path="/manage-booking" element={<p>Manage booking marker</p>} />
        <Route path="/vehicles/:id" element={<p>Vehicle detail marker</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function openSearch() {
  await userEvent.click(screen.getByRole('button', { name: /^search$/i }))
}

describe('SiteSearch', () => {
  beforeEach(() => {
    vi.mocked(fetchAllAvailableVehicles).mockReset().mockResolvedValue([])
  })

  it('is closed by default with no panel or input in the DOM', () => {
    renderIt()
    const trigger = screen.getByRole('button', { name: /^search$/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the panel with a text field on click, fetching the fleet only once opened', async () => {
    renderIt()
    expect(fetchAllAvailableVehicles).not.toHaveBeenCalled()

    await openSearch()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/search pages or cars/i)).toBeInTheDocument()
    expect(fetchAllAvailableVehicles).toHaveBeenCalledTimes(1)
  })

  it('finds a matching page by title and navigates to it on click', async () => {
    renderIt()
    await openSearch()
    // "about bliss" (from the About page's own description, "Learn about
    // Bliss Rent") rather than plain "about" — the FAQs page's subtitle
    // ("Quick answers about booking…") also contains "about" and would
    // otherwise match too, making this ambiguous.
    await userEvent.type(screen.getByPlaceholderText(/search pages or cars/i), 'about bliss')

    const result = screen.getByRole('option', { name: /about/i })
    expect(result).toBeInTheDocument()
    // The clickable element is the button nested inside the `role="option"`
    // <li> (which carries the accessible name), not the <li> itself — a
    // click dispatched at the <li> wouldn't bubble down into it.
    await userEvent.click(within(result).getByRole('button'))

    expect(screen.getByText('About page marker')).toBeInTheDocument()
    // Selecting a result closes the panel and clears the query.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('finds a page by an alias keyword, not just its title', async () => {
    renderIt()
    await openSearch()
    await userEvent.type(screen.getByPlaceholderText(/search pages or cars/i), 'extend')

    expect(screen.getByRole('option', { name: /manage booking/i })).toBeInTheDocument()
  })

  it('shows a no-results message for an unmatched query', async () => {
    renderIt()
    await openSearch()
    await userEvent.type(screen.getByPlaceholderText(/search pages or cars/i), 'zzz-nonexistent')

    expect(screen.getByText(/no matching results/i)).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('navigates to the first result on ArrowDown + Enter', async () => {
    renderIt()
    await openSearch()
    await userEvent.type(screen.getByPlaceholderText(/search pages or cars/i), 'about bliss')
    await userEvent.keyboard('{ArrowDown}{Enter}')

    expect(screen.getByText('About page marker')).toBeInTheDocument()
  })

  it('closes on outside click and on Escape', async () => {
    renderIt()
    const trigger = screen.getByRole('button', { name: /^search$/i })

    await userEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('car results', () => {
    it('finds a real car by make/model and navigates to its detail page on click', async () => {
      vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([
        vehicle({ id: 'v1', make: 'Toyota', model: 'Fortuner' }),
        vehicle({ id: 'v2', make: 'Nissan', model: 'Patrol' }),
      ])
      renderIt()
      await openSearch()
      await userEvent.type(screen.getByPlaceholderText(/search pages or cars/i), 'fortuner')

      const result = await screen.findByRole('option', { name: /toyota fortuner/i })
      expect(within(result).getByText(/149/)).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: /patrol/i })).not.toBeInTheDocument()

      await userEvent.click(within(result).getByRole('button'))
      expect(screen.getByText('Vehicle detail marker')).toBeInTheDocument()
    })

    it('also matches by category name (e.g. "SUV")', async () => {
      vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([
        vehicle({ id: 'v1', make: 'Toyota', model: 'Fortuner', vehicle_categories: { id: 'cat-suv', name: 'SUV', description: null, created_at: '2026-01-01T00:00:00Z' } }),
      ])
      renderIt()
      await openSearch()
      await userEvent.type(screen.getByPlaceholderText(/search pages or cars/i), 'suv')

      expect(await screen.findByRole('option', { name: /toyota fortuner/i })).toBeInTheDocument()
    })

    it('shows pages and cars as separate labeled sections when both match', async () => {
      vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([vehicle({ id: 'v1', make: 'Fleet', model: 'Runner' })])
      renderIt()
      await openSearch()
      await userEvent.type(screen.getByPlaceholderText(/search pages or cars/i), 'fleet')

      const pagesList = screen.getByRole('listbox', { name: 'Pages' })
      const carsList = await screen.findByRole('listbox', { name: 'Cars' })
      expect(within(pagesList).getByRole('option')).toBeInTheDocument()
      expect(within(carsList).getByRole('option', { name: /fleet runner/i })).toBeInTheDocument()
    })

    it('never surfaces a car that has no valid price or photo (same public-listing rule as /search)', async () => {
      vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([vehicle({ id: 'v1', make: 'Toyota', model: 'Fortuner', pricing: [] })])
      renderIt()
      await openSearch()
      await userEvent.type(screen.getByPlaceholderText(/search pages or cars/i), 'fortuner')

      await waitFor(() => expect(fetchAllAvailableVehicles).toHaveBeenCalled())
      expect(screen.queryByRole('option', { name: /fortuner/i })).not.toBeInTheDocument()
      expect(screen.getByText(/no matching results/i)).toBeInTheDocument()
    })
  })
})
