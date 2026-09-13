import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CitiesMenu } from '@/features/shared/CitiesMenu'
import { fetchLocations } from '@/features/booking/api'
import type { Location } from '@/types/domain'

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
      <CitiesMenu tone="dark" />
    </MemoryRouter>,
  )
}

describe('CitiesMenu', () => {
  beforeEach(() => {
    vi.mocked(fetchLocations).mockReset()
  })

  it('renders nothing until real cities load, and nothing at all when there are none', async () => {
    vi.mocked(fetchLocations).mockResolvedValue([])
    const { container } = renderIt()
    expect(container).toBeEmptyDOMElement()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('opens to show every real live city with its pickup-point count', async () => {
    vi.mocked(fetchLocations).mockResolvedValue([
      location({ id: 'l1', city: 'Dubai', type: 'airport', airport_code: 'DXB' }),
      location({ id: 'l2', city: 'Ajman', type: 'city' }),
      location({ id: 'l3', city: 'Ajman', type: 'hotel' }),
    ])
    renderIt()

    const trigger = await screen.findByRole('button', { name: /cities/i })
    await userEvent.click(trigger)

    expect(screen.getByText('Dubai')).toBeInTheDocument()
    expect(screen.getByText('1 pickup point')).toBeInTheDocument()
    expect(screen.getByText('Ajman')).toBeInTheDocument()
    expect(screen.getByText('2 pickup points')).toBeInTheDocument()
  })

  it('closes on outside click and on Escape', async () => {
    vi.mocked(fetchLocations).mockResolvedValue([location({ id: 'l1', city: 'Dubai', type: 'airport' })])
    renderIt()

    const trigger = await screen.findByRole('button', { name: /cities/i })
    await userEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await userEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.click(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('links each city and the "view all" row to the real Locations page', async () => {
    vi.mocked(fetchLocations).mockResolvedValue([location({ id: 'l1', city: 'Dubai', type: 'airport' })])
    renderIt()

    await userEvent.click(await screen.findByRole('button', { name: /cities/i }))
    expect(screen.getByText('Dubai').closest('a')).toHaveAttribute('href', '/locations')
    expect(screen.getByRole('link', { name: /view all locations/i })).toHaveAttribute('href', '/locations')
  })
})
