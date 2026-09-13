import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LocationsPage } from '@/features/content/LocationsPage'
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
      <LocationsPage />
    </MemoryRouter>,
  )
}

describe('LocationsPage', () => {
  beforeEach(() => {
    vi.mocked(fetchLocations).mockReset()
  })

  it('never shows the old leftover placeholder text on a city card (regression)', async () => {
    vi.mocked(fetchLocations).mockResolvedValue([
      location({ id: 'l1', city: 'Dubai', type: 'airport', name: 'DXB Terminal 3' }),
    ])
    renderIt()

    await screen.findByText('Dubai')
    expect(screen.queryByText(/book until/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/economy class return/i)).not.toBeInTheDocument()
  })

  it('shows the real location types and a real pickup-point count per city instead', async () => {
    vi.mocked(fetchLocations).mockResolvedValue([
      location({ id: 'l1', city: 'Dubai', type: 'airport' }),
      location({ id: 'l2', city: 'Dubai', type: 'hotel' }),
    ])
    renderIt()

    await screen.findByText('Dubai')
    expect(screen.getByText('Airport pickup')).toBeInTheDocument()
    expect(screen.getByText('Hotel / accommodation delivery')).toBeInTheDocument()
    expect(screen.queryByText('Delivery')).not.toBeInTheDocument()
    expect(screen.getByText('2 pickup points')).toBeInTheDocument()
  })
})
