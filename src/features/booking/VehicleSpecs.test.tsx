import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VehicleSpecs } from '@/features/booking/VehicleSpecs'
import type { SpecSource } from '@/lib/vehicleSpecs'

const bare: SpecSource = {
  make: 'Toyota',
  model: 'Corolla',
  model_year: 2023,
  transmission: 'automatic',
  seats: 5,
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
  vehicle_categories: { name: 'Economy' },
}

const rich: SpecSource = {
  ...bare,
  make: 'Rolls-Royce',
  model: 'Cullinan',
  engine: '6.75L twin-turbo V12',
  horsepower: 563,
  torque_nm: 850,
  top_speed_kmh: 250,
  acceleration_0_100: 5.2,
  fuel_type: 'Petrol',
  fuel_consumption_l100km: 15,
  drivetrain: 'AWD',
  doors: 4,
  origin_country: 'United Kingdom',
  about: 'First paragraph about the car.\n\nSecond paragraph, its history.',
  vehicle_categories: { name: 'Luxury' },
}

const specsPanel = () => screen.getByRole('heading', { name: 'Full specifications' }).closest('section') as HTMLElement
const aboutPanel = () => screen.getByRole('heading', { name: 'About the Rolls-Royce Cullinan' }).closest('section') as HTMLElement

describe('VehicleSpecs', () => {
  it('shows the about story and the full table for a well-documented car', () => {
    render(<VehicleSpecs vehicle={rich} />)

    expect(screen.getByText('First paragraph about the car.')).toBeInTheDocument()
    expect(screen.getByText('Second paragraph, its history.')).toBeInTheDocument()

    const table = within(specsPanel())
    expect(table.getByText('6.75L twin-turbo V12')).toBeInTheDocument()
    expect(table.getByText('563 hp')).toBeInTheDocument()
    expect(table.getByText('850 Nm')).toBeInTheDocument()
    expect(table.getByText('5.2 s')).toBeInTheDocument()
    expect(table.getByText('250 km/h')).toBeInTheDocument()
    expect(table.getByText('6.7 km/L · 15 L/100 km')).toBeInTheDocument()
    expect(table.getByText('All-wheel drive (AWD)')).toBeInTheDocument()
    expect(table.getByText('United Kingdom')).toBeInTheDocument()
  })

  it('no longer repeats the headline numbers as a separate strip — they live in the booking box', () => {
    render(<VehicleSpecs vehicle={rich} />)
    expect(screen.queryByRole('region', { name: 'Key figures' })).not.toBeInTheDocument()
  })

  it('gives every row in the table an icon', () => {
    render(<VehicleSpecs vehicle={rich} />)
    const rows = specsPanel().querySelectorAll('dl > div')
    expect(rows.length).toBeGreaterThan(10)
    rows.forEach((row) => expect(row.querySelector('dt svg')).not.toBeNull())
  })

  describe('tabs (phones)', () => {
    it('offers About and Specifications tabs, opening on About', () => {
      render(<VehicleSpecs vehicle={rich} />)

      const tabs = within(screen.getByRole('tablist', { name: 'Car information' }))
      expect(tabs.getByRole('tab', { name: 'About' })).toHaveAttribute('aria-selected', 'true')
      expect(tabs.getByRole('tab', { name: 'Specifications' })).toHaveAttribute('aria-selected', 'false')
      // The other panel is hidden on phones only (`hidden md:block`) — on wider screens both show.
      expect(aboutPanel().className).not.toMatch(/\bhidden\b/)
      expect(specsPanel().className).toContain('hidden md:block')
    })

    it('switches the visible panel when a tab is pressed', async () => {
      const user = userEvent.setup()
      render(<VehicleSpecs vehicle={rich} />)

      await user.click(screen.getByRole('tab', { name: 'Specifications' }))
      expect(screen.getByRole('tab', { name: 'Specifications' })).toHaveAttribute('aria-selected', 'true')
      expect(specsPanel().className).not.toMatch(/\bhidden\b/)
      expect(aboutPanel().className).toContain('hidden md:block')

      await user.click(screen.getByRole('tab', { name: 'About' }))
      expect(aboutPanel().className).not.toMatch(/\bhidden\b/)
    })

    it('ties each tab to its panel for screen readers', () => {
      render(<VehicleSpecs vehicle={rich} />)
      expect(screen.getByRole('tab', { name: 'About' })).toHaveAttribute('aria-controls', 'vehicle-panel-about')
      expect(aboutPanel()).toHaveAttribute('aria-labelledby', 'vehicle-tab-about')
      expect(specsPanel()).toHaveAttribute('aria-labelledby', 'vehicle-tab-specs')
    })
  })

  it('shows only the table — no tabs, no empty headings, no filler — when no history is recorded', () => {
    render(<VehicleSpecs vehicle={bare} />)

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^About the/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Engine')).not.toBeInTheDocument()
    expect(screen.queryByText(/N\/A|unknown/i)).not.toBeInTheDocument()
    expect(specsPanel().className).not.toMatch(/\bhidden\b/)

    const table = within(specsPanel())
    expect(table.getByText('Toyota')).toBeInTheDocument()
    expect(table.getByText('Corolla')).toBeInTheDocument()
    expect(table.getByText('2023')).toBeInTheDocument()
    expect(table.getByText('Automatic')).toBeInTheDocument()
  })
})
