import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AboutPage } from '@/features/content/AboutPage'

const fetchAllAvailableVehicles = vi.fn()
const fetchLocations = vi.fn()

vi.mock('@/features/booking/api', () => ({
  fetchAllAvailableVehicles: (...args: unknown[]) => fetchAllAvailableVehicles(...args),
  fetchLocations: (...args: unknown[]) => fetchLocations(...args),
}))

function renderIt() {
  return render(
    <MemoryRouter>
      <AboutPage />
    </MemoryRouter>,
  )
}

describe('AboutPage', () => {
  beforeEach(() => {
    fetchAllAvailableVehicles.mockReset().mockResolvedValue([])
    fetchLocations.mockReset().mockResolvedValue([])
  })

  it('renders the real title, story, and all four values with a numbered index', () => {
    renderIt()

    expect(screen.getByRole('heading', { level: 1, name: 'About Bliss Rent' })).toBeInTheDocument()
    expect(screen.getByText(/Bliss Rent was created to solve one specific problem/)).toBeInTheDocument()
    expect(screen.getByText('Transparency')).toBeInTheDocument()
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('04')).toBeInTheDocument()
  })

  it('shows the live stats section only once real data resolves — never a fabricated number', async () => {
    renderIt()
    expect(screen.queryByText('Bliss Rent today')).not.toBeInTheDocument()

    fetchAllAvailableVehicles.mockResolvedValue([
      { id: 'v1', vehicle_categories: { name: 'Economy' } },
      { id: 'v2', vehicle_categories: { name: 'Luxury' } },
    ])
    fetchLocations.mockResolvedValue([{ city: 'Dubai' }, { city: 'Abu Dhabi' }])
    renderIt()

    await waitFor(() => expect(screen.getByText('Bliss Rent today')).toBeInTheDocument())
    expect(screen.getByText('2 vehicles ready to book')).toBeInTheDocument()
  })

  it('links the closing CTA to real booking/browse routes', () => {
    renderIt()
    expect(screen.getByRole('link', { name: /book now/i })).toHaveAttribute('href', '/book')
    expect(screen.getByRole('link', { name: /view fleet/i })).toHaveAttribute('href', '/search')
  })
})
