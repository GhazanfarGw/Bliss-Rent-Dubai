import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LocationsPreviewSection } from '@/features/booking/LocationsPreviewSection'
import { fetchLocations } from '@/features/booking/api'
import type { Location } from '@/types/domain'

/** A pin's label wrapper is tagged data-label-for (see LocationsPreviewSection.tsx) — asserts on its class tokens directly, same "check the class list" pattern NavBar.test.tsx uses, since jsdom never computes real CSS from a Tailwind class name. */
function mobileLabelClasses(cityName: string): string[] {
  const wrapper = document.querySelector(`[data-label-for="${cityName}"]`)
  return (wrapper as HTMLElement).className.split(' ')
}

/** A pin's label link, by exact city. (Not by name regex: the photo-credit links below the map also mention the city, e.g. "Dubai — imran shahabuddin".) */
async function findLabelLink(city: string): Promise<HTMLElement> {
  return waitFor(() => {
    const link = document.querySelector(`[data-label-for="${city}"] a`)
    expect(link).not.toBeNull()
    return link as HTMLElement
  })
}

vi.mock('@/features/booking/api', () => ({
  fetchLocations: vi.fn(),
}))

function location(overrides: Partial<Location> & { id: string; city: string; type: Location['type'] }): Location {
  return {
    name: 'Test Location',
    country: 'United Arab Emirates',
    airport_code: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Location
}

function renderIt() {
  return render(
    <MemoryRouter>
      <LocationsPreviewSection />
    </MemoryRouter>,
  )
}

describe('LocationsPreviewSection', () => {
  beforeEach(() => {
    vi.mocked(fetchLocations).mockReset()
  })

  it('shows a loading message, then an honest empty state when there are no live locations', async () => {
    vi.mocked(fetchLocations).mockResolvedValue([])
    renderIt()

    expect(screen.getByText('Loading locations…')).toBeInTheDocument()
    expect(await screen.findByText(/locations are added and updated live/i)).toBeInTheDocument()
  })

  it('pins every live city with its real pickup-point count, Dubai marked as the hub', async () => {
    vi.mocked(fetchLocations).mockResolvedValue([
      location({ id: 'l1', city: 'Dubai', type: 'airport' }),
      location({ id: 'l2', city: 'Dubai', type: 'city' }),
      location({ id: 'l3', city: 'Abu Dhabi', type: 'airport' }),
    ])
    renderIt()

    // Each placed city has exactly one link — its map label. (There used
    // to be a second, mobile-only chip list repeating them; it's gone.)
    const dubaiLink = await findLabelLink('Dubai')
    expect(dubaiLink).toHaveTextContent('2 pickup points')
    expect(dubaiLink).toHaveTextContent('Hub')
    // Each label opens its city's own page (/locations/:slug).
    expect(dubaiLink).toHaveAttribute('href', '/locations/dubai')

    const abuDhabiLink = await findLabelLink('Abu Dhabi')
    expect(abuDhabiLink).toHaveTextContent('1 pickup point')
    expect(abuDhabiLink).not.toHaveTextContent('Hub')
  })

  it('does not repeat the placed cities as a separate chip list under the map', async () => {
    vi.mocked(fetchLocations).mockResolvedValue([
      location({ id: 'l1', city: 'Dubai', type: 'airport' }),
      location({ id: 'l2', city: 'Abu Dhabi', type: 'airport' }),
    ])
    renderIt()

    await findLabelLink('Dubai')
    // Two labels (each to its own city page) + the "View all locations"
    // button — nothing else.
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('draws a coverage route line from the hub to every other pinned city', async () => {
    vi.mocked(fetchLocations).mockResolvedValue([
      location({ id: 'l1', city: 'Dubai', type: 'airport' }),
      location({ id: 'l2', city: 'Abu Dhabi', type: 'airport' }),
      location({ id: 'l3', city: 'Sharjah', type: 'airport' }),
    ])
    const { container } = renderIt()

    await waitFor(() => expect(screen.getAllByRole('link', { name: /pickup point/i }).length).toBe(3))
    // Hub (Dubai) -> Abu Dhabi, Hub -> Sharjah: one dashed route line per
    // non-hub city…
    expect(container.querySelectorAll('svg line[stroke-dasharray]').length).toBe(2)
    // …plus a solid leader line tying each label to its pin (jsdom has no
    // layout, so the panel falls back to a wide one: every label shows).
    expect(container.querySelectorAll('svg line:not([stroke-dasharray])').length).toBe(3)
  })

  it('lists a real city with no fixed map position as a plain chip instead of dropping it', async () => {
    vi.mocked(fetchLocations).mockResolvedValue([location({ id: 'l1', city: 'Al Reef Village', type: 'city' })])
    renderIt()

    const link = await screen.findByRole('link', { name: /al reef village/i })
    expect(link).toHaveAttribute('href', '/locations')
  })

  it('links "View all locations" to the full locations page', async () => {
    vi.mocked(fetchLocations).mockResolvedValue([location({ id: 'l1', city: 'Dubai', type: 'airport' })])
    renderIt()

    expect(await screen.findByRole('link', { name: /view all locations/i })).toHaveAttribute('href', '/locations')
  })

  describe('hover preview (desktop)', () => {
    beforeEach(() => {
      vi.mocked(fetchLocations).mockResolvedValue([
        location({ id: 'd1', city: 'Dubai', type: 'airport', name: 'Dubai International Airport', airport_code: 'DXB' }),
        location({ id: 'd2', city: 'Dubai', type: 'city', name: 'Dubai Downtown' }),
        location({ id: 'd3', city: 'Dubai', type: 'hotel', name: 'Dubai Hotel Delivery' }),
        location({ id: 'd4', city: 'Dubai', type: 'city', name: 'Dubai Marina' }),
        location({ id: 'd5', city: 'Dubai', type: 'city', name: 'Dubai JLT' }),
        location({ id: 'a1', city: 'Abu Dhabi', type: 'airport', name: 'Abu Dhabi International Airport' }),
      ])
    })

    it('mounts no photo or details until a label is first hovered', async () => {
      const { container } = renderIt()
      await findLabelLink('Dubai')

      expect(container.querySelector('img')).toBeNull()
      expect(screen.queryByText('Dubai Downtown')).not.toBeInTheDocument()
    })

    it("shows the city's real photo and its first pickup points, with a +N more, on hover", async () => {
      const { container } = renderIt()
      await userEvent.hover(await findLabelLink('Dubai'))

      const preview = container.querySelector('[data-city-preview="Dubai"]') as HTMLElement
      expect(preview).not.toBeNull()
      expect(preview.querySelector('img')?.getAttribute('src')).toContain('dubai')
      // First three of the five real points by name, then the remainder.
      expect(within(preview).getByText('Dubai International Airport')).toBeInTheDocument()
      expect(within(preview).getByText('Dubai Downtown')).toBeInTheDocument()
      expect(within(preview).getByText('Dubai Hotel Delivery')).toBeInTheDocument()
      expect(within(preview).queryByText('Dubai Marina')).not.toBeInTheDocument()
      expect(within(preview).getByText('+2 more')).toBeInTheDocument()
      expect(within(preview).getByText('5 pickup points')).toBeInTheDocument()
    })

    it('only mounts the preview of the city that was hovered', async () => {
      const { container } = renderIt()
      await userEvent.hover(await findLabelLink('Abu Dhabi'))

      expect(container.querySelector('[data-label-for="Abu Dhabi"] img')).not.toBeNull()
      expect(container.querySelector('[data-label-for="Dubai"] img')).toBeNull()
    })

    it('shows no photo-credit text under the map (credits live with the photo, on each city page)', async () => {
      renderIt()
      await findLabelLink('Dubai')

      expect(screen.queryByText(/wikimedia/i)).not.toBeInTheDocument()
      expect(document.querySelector('a[href*="commons.wikimedia.org"]')).toBeNull()
    })
  })

  describe('tapping a pin (mobile map interaction)', () => {
    beforeEach(() => {
      vi.mocked(fetchLocations).mockResolvedValue([
        location({ id: 'l1', city: 'Dubai', type: 'airport' }),
        location({ id: 'l2', city: 'Abu Dhabi', type: 'airport' }),
      ])
    })

    it('draws a location-pin glyph inside every dot', async () => {
      renderIt()
      for (const city of ['Dubai', 'Abu Dhabi']) {
        const dot = await screen.findByRole('button', { name: city })
        expect(dot.querySelector('svg')).not.toBeNull()
      }
    })

    it("starts with every pin's label closed", async () => {
      renderIt()
      await screen.findByRole('button', { name: 'Dubai' })

      expect(mobileLabelClasses('Dubai')).toContain('hidden')
      expect(mobileLabelClasses('Dubai')).not.toContain('flex')
    })

    it('opens a pin on tap, and closes it again on a second tap', async () => {
      renderIt()
      const dubaiDot = await screen.findByRole('button', { name: 'Dubai' })

      await userEvent.click(dubaiDot)
      expect(dubaiDot).toHaveAttribute('aria-expanded', 'true')
      expect(mobileLabelClasses('Dubai')).toContain('flex')
      expect(mobileLabelClasses('Dubai')).not.toContain('hidden')

      await userEvent.click(dubaiDot)
      expect(dubaiDot).toHaveAttribute('aria-expanded', 'false')
      expect(mobileLabelClasses('Dubai')).toContain('hidden')
    })

    it('opening a second pin closes the first — only one label open at a time', async () => {
      renderIt()
      const dubaiDot = await screen.findByRole('button', { name: 'Dubai' })
      const abuDhabiDot = screen.getByRole('button', { name: 'Abu Dhabi' })

      await userEvent.click(dubaiDot)
      expect(mobileLabelClasses('Dubai')).toContain('flex')

      await userEvent.click(abuDhabiDot)
      expect(mobileLabelClasses('Abu Dhabi')).toContain('flex')
      expect(mobileLabelClasses('Dubai')).toContain('hidden')
      expect(dubaiDot).toHaveAttribute('aria-expanded', 'false')
    })

    it('closes the open pin on an outside click', async () => {
      renderIt()
      const dubaiDot = await screen.findByRole('button', { name: 'Dubai' })

      await userEvent.click(dubaiDot)
      expect(mobileLabelClasses('Dubai')).toContain('flex')

      await userEvent.click(document.body)
      expect(mobileLabelClasses('Dubai')).toContain('hidden')
    })
  })
})
