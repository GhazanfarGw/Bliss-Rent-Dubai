import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SiteSearch } from '@/features/shared/SiteSearch'
import { BLOG_POSTS } from '@/features/blog/blogPosts'
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
        <Route path="/locations/:slug" element={<p>City page marker</p>} />
        <Route path="/search" element={<p>Fleet page marker</p>} />
        <Route path="/blog/:slug" element={<p>Blog article marker</p>} />
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
    expect(screen.getByPlaceholderText(/search cars, cities and pages/i)).toBeInTheDocument()
    expect(fetchAllAvailableVehicles).toHaveBeenCalledTimes(1)
  })

  it('finds a matching page by title and navigates to it on click', async () => {
    renderIt()
    await openSearch()
    // "about bliss" (from the About page's own description, "Learn about
    // Bliss Rent") rather than plain "about" — the FAQs page's subtitle
    // ("Quick answers about booking…") also contains "about" and would
    // otherwise match too, making this ambiguous.
    await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'about bliss')

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
    await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'extend')

    expect(screen.getByRole('option', { name: /manage booking/i })).toBeInTheDocument()
  })

  it('shows a no-results message for an unmatched query', async () => {
    renderIt()
    await openSearch()
    await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'zzz-nonexistent')

    expect(screen.getByText(/no matching results/i)).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('navigates to the first result on ArrowDown + Enter', async () => {
    renderIt()
    await openSearch()
    await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'about bliss')
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

  it('finds a city page by the city name and opens it', async () => {
    renderIt()
    await openSearch()
    await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'sharjah')

    // Ajman's blurb mentions Sharjah too, so it's a second (later) hit —
    // the city itself must still come first.
    const [result] = screen.getAllByRole('option')
    expect(result).toHaveAccessibleName(/^sharjah/i)
    await userEvent.click(within(result).getByRole('button'))
    expect(screen.getByText('City page marker')).toBeInTheDocument()
  })

  it('finds a blog article by its headline and opens it', async () => {
    renderIt()
    await openSearch()
    await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'jebel jais')

    const result = screen.getByRole('option', { name: /Ras Al Khaimah & Jebel Jais by Car/ })
    await userEvent.click(within(result).getByRole('button'))
    expect(screen.getByText('Blog article marker')).toBeInTheDocument()
  })

  it('keeps a broad query to a few blog suggestions rather than flooding the list', async () => {
    renderIt()
    await openSearch()
    await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'dubai')

    const blogTitles = BLOG_POSTS.map((post) => post.en.title)
    const shown = screen.getAllByRole('option').filter((option) => blogTitles.some((title) => (option.textContent ?? '').includes(title)))
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThanOrEqual(4)
  })

  describe('the search palette', () => {
    it('opens as a modal dialog with a large field focused, and offers shortcuts before anything is typed', async () => {
      renderIt()
      await openSearch()

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(screen.getByPlaceholderText(/search cars, cities and pages/i)).toHaveFocus()
      // Key pages, and the cities served — nothing typed yet.
      expect(within(dialog).getByText('Quick links')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: /find your rental/i })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: /^dubai$/i })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: /fujairah/i })).toBeInTheDocument()
    })

    it('opens a quick link straight from the empty state', async () => {
      renderIt()
      await openSearch()
      await userEvent.click(screen.getByRole('button', { name: /find your rental/i }))

      expect(screen.getByText('Fleet page marker')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('offers the live vehicle categories, premium-first with their car counts, each opening the fleet filtered to it', async () => {
      vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([
        vehicle({ id: 'v1', vehicle_categories: { id: 'cat-eco', name: 'Economy', description: null, created_at: '' } as never }),
        vehicle({ id: 'v2', make: 'Ferrari', model: '488', vehicle_categories: { id: 'cat-sports', name: 'Sports & Supercars', description: null, created_at: '' } as never }),
        vehicle({ id: 'v3', make: 'Lamborghini', model: 'Huracan', vehicle_categories: { id: 'cat-sports', name: 'Sports & Supercars', description: null, created_at: '' } as never }),
      ])
      renderIt()
      await openSearch()

      const sports = await screen.findByRole('button', { name: /sports & supercars/i })
      const chips = within(screen.getByRole('dialog')).getAllByRole('button', { name: /(sports & supercars|economy)\s*\d/i })
      expect(chips.map((chip) => chip.textContent)).toEqual(['Sports & Supercars2', 'Economy1'])

      await userEvent.click(sports)
      expect(screen.getByText('Fleet page marker')).toBeInTheDocument()
    })

    it('shows no category chips until the fleet has loaded — never invented ones', async () => {
      vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([])
      renderIt()
      await openSearch()

      await waitFor(() => expect(fetchAllAvailableVehicles).toHaveBeenCalled())
      expect(screen.queryByText('Browse by category')).not.toBeInTheDocument()
    })

    it('groups results into labelled sections — cars first, then cities, pages, articles', async () => {
      vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([vehicle({ id: 'v1', make: 'Dubai', model: 'Cruiser' })])
      renderIt()
      await openSearch()
      await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'dubai')

      const lists = await screen.findAllByRole('listbox')
      expect(lists.map((list) => list.getAttribute('aria-label'))).toEqual(['Cars', 'Cities', 'Pages', 'Guides & articles'])
    })

    it('highlights the part of a result that matched the query', async () => {
      renderIt()
      await openSearch()
      await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'sharjah')

      const [result] = screen.getAllByRole('option')
      expect(within(result).getByText('Sharjah', { selector: 'mark' })).toBeInTheDocument()
    })

    it('moves the highlighted result with the arrow keys and opens the one it is on with Enter', async () => {
      renderIt()
      await openSearch()
      await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'sharjah')

      const options = screen.getAllByRole('option')
      expect(options.length).toBeGreaterThan(1)
      expect(options[0]).toHaveAttribute('aria-selected', 'true')

      await userEvent.keyboard('{ArrowDown}')
      expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-activedescendant', 'site-search-option-1')

      await userEvent.keyboard('{ArrowUp}{ArrowUp}')
      // Wraps from the first result back to the last.
      expect(screen.getAllByRole('option').at(-1)).toHaveAttribute('aria-selected', 'true')
    })

    it('clears the query with the clear button and keeps focus in the field', async () => {
      renderIt()
      await openSearch()
      const input = screen.getByPlaceholderText(/search cars, cities and pages/i)
      await userEvent.type(input, 'sharjah')

      await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
      expect(input).toHaveValue('')
      expect(input).toHaveFocus()
      expect(screen.getByText('Quick links')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
    })

    it('closes with its close button and hands focus back to the Search button', async () => {
      renderIt()
      const trigger = screen.getByRole('button', { name: /^search$/i })
      await userEvent.click(trigger)

      await userEvent.click(screen.getByRole('button', { name: 'Close search' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(trigger).toHaveFocus()
    })

    it('locks the page behind it while open and unlocks it on close', async () => {
      renderIt()
      expect(document.body.style.overflow).toBe('')

      await openSearch()
      expect(document.body.style.overflow).toBe('hidden')

      await userEvent.keyboard('{Escape}')
      expect(document.body.style.overflow).toBe('')
    })

    it('shows the label on the desktop button but only an icon in its compact (phone) form', () => {
      const first = render(
        <MemoryRouter>
          <SiteSearch />
        </MemoryRouter>,
      )
      expect(screen.getByRole('button', { name: /^search$/i }).textContent).toContain('Search')
      first.unmount()

      render(
        <MemoryRouter>
          <SiteSearch compact />
        </MemoryRouter>,
      )
      expect(screen.getByRole('button', { name: /^search$/i }).textContent).toBe('')
    })

    it('points a no-result search at the full fleet instead of leaving a dead end', async () => {
      renderIt()
      await openSearch()
      await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'zzz-nonexistent')

      await userEvent.click(screen.getByRole('button', { name: /browse the fleet/i }))
      expect(screen.getByText('Fleet page marker')).toBeInTheDocument()
    })
  })

  describe('car results', () => {
    it('finds a real car by make/model and navigates to its detail page on click', async () => {
      vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([
        vehicle({ id: 'v1', make: 'Toyota', model: 'Fortuner' }),
        vehicle({ id: 'v2', make: 'Nissan', model: 'Patrol' }),
      ])
      renderIt()
      await openSearch()
      await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'fortuner')

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
      await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'suv')

      expect(await screen.findByRole('option', { name: /toyota fortuner/i })).toBeInTheDocument()
    })

    it('shows pages and cars as separate labeled sections when both match', async () => {
      vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([vehicle({ id: 'v1', make: 'Fleet', model: 'Runner' })])
      renderIt()
      await openSearch()
      await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'fleet')

      const pagesList = screen.getByRole('listbox', { name: 'Pages' })
      const carsList = await screen.findByRole('listbox', { name: 'Cars' })
      expect(within(pagesList).getByRole('option')).toBeInTheDocument()
      expect(within(carsList).getByRole('option', { name: /fleet runner/i })).toBeInTheDocument()
    })

    it('never surfaces a car that has no valid price or photo (same public-listing rule as /search)', async () => {
      vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([vehicle({ id: 'v1', make: 'Toyota', model: 'Fortuner', pricing: [] })])
      renderIt()
      await openSearch()
      await userEvent.type(screen.getByPlaceholderText(/search cars, cities and pages/i), 'fortuner')

      await waitFor(() => expect(fetchAllAvailableVehicles).toHaveBeenCalled())
      expect(screen.queryByRole('option', { name: /fortuner/i })).not.toBeInTheDocument()
      expect(screen.getByText(/no matching results/i)).toBeInTheDocument()
    })
  })
})
