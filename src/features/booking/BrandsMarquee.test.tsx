import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrandsMarquee } from '@/features/booking/BrandsMarquee'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import type { VehicleWithDetails } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchAllAvailableVehicles: vi.fn(),
}))

function vehicle(make: string, id: string): VehicleWithDetails {
  return { id, make } as unknown as VehicleWithDetails
}

describe('BrandsMarquee', () => {
  beforeEach(() => {
    vi.mocked(fetchAllAvailableVehicles).mockReset()
  })

  it('renders a real logo mark for a brand simple-icons carries', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([vehicle('Toyota', 'v1'), vehicle('BMW', 'v2')])
    render(<BrandsMarquee />)

    const marks = await screen.findAllByRole('img', { name: 'Toyota' })
    expect(marks[0].tagName.toLowerCase()).toBe('svg')
    expect(marks[0].getAttribute('viewBox')).toBe('0 0 24 24')
  })

  it('falls back to an initials badge, never a fabricated logo, for a brand no library carries', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([vehicle('Lexus', 'v1')])
    render(<BrandsMarquee />)

    expect(await screen.findByText('LE')).toBeInTheDocument()
  })

  it('renders the Mercedes-Benz mark sourced from cardog-ai/icons on its own viewBox', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([vehicle('Mercedes-Benz', 'v1'), vehicle('Toyota', 'v2')])
    render(<BrandsMarquee />)

    const marks = await screen.findAllByRole('img', { name: 'Mercedes-Benz' })
    expect(marks[0].tagName.toLowerCase()).toBe('svg')
    expect(marks[0].getAttribute('viewBox')).toBe('0 0 512 512')
  })

  it('renders the Brabus mark (Wikimedia Commons, PD-textlogo) with its source transform applied', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([vehicle('Brabus', 'v1')])
    render(<BrandsMarquee />)

    const marks = await screen.findAllByRole('img', { name: 'Brabus' })
    expect(marks[0].querySelector('g[transform]')).not.toBeNull()
  })

  it('renders the JAC mark as an <img>, since only a raster (PNG) source exists for it', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([vehicle('JAC', 'v1')])
    render(<BrandsMarquee />)

    const marks = await screen.findAllByRole('img', { name: 'JAC' })
    expect(marks[0].tagName.toLowerCase()).toBe('img')
  })

  it('renders nothing when the live fleet has no brands', async () => {
    vi.mocked(fetchAllAvailableVehicles).mockResolvedValue([])
    const { container } = render(<BrandsMarquee />)

    await Promise.resolve()
    expect(container).toBeEmptyDOMElement()
  })
})
