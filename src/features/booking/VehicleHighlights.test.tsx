import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { VehicleHighlights } from '@/features/booking/VehicleHighlights'
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

describe('VehicleHighlights', () => {
  it('shows power, torque, 0–100, top speed and the engine as icon tiles', () => {
    const car: SpecSource = {
      ...bare,
      engine: '4.0L twin-turbo V8',
      horsepower: 720,
      torque_nm: 770,
      acceleration_0_100: 2.9,
      top_speed_kmh: 341,
    }
    const { container } = render(<VehicleHighlights vehicle={car} />)

    const tiles = within(screen.getByLabelText('Key figures'))
    expect(tiles.getByText('720 hp')).toBeInTheDocument()
    expect(tiles.getByText('770 Nm')).toBeInTheDocument()
    expect(tiles.getByText('2.9 s')).toBeInTheDocument()
    expect(tiles.getByText('341 km/h')).toBeInTheDocument()
    expect(tiles.getByText('4.0L twin-turbo V8')).toBeInTheDocument()
    // Every tile carries an icon.
    expect(container.querySelectorAll('dl > div')).toHaveLength(5)
    container.querySelectorAll('dl > div').forEach((tile) => expect(tile.querySelector('svg')).not.toBeNull())
  })

  it('falls back to fuel, drive layout, doors and origin for a car with no performance figures', () => {
    const car: SpecSource = { ...bare, fuel_type: 'Petrol', drivetrain: 'fwd', doors: 4, origin_country: 'Japan' }
    render(<VehicleHighlights vehicle={car} />)

    const tiles = within(screen.getByLabelText('Key figures'))
    expect(tiles.getByText('Petrol')).toBeInTheDocument()
    expect(tiles.getByText('FWD')).toBeInTheDocument()
    expect(tiles.getByText('4')).toBeInTheDocument()
    expect(tiles.getByText('Japan')).toBeInTheDocument()
  })

  it('shows at most four facts plus the engine, keeping the performance numbers first', () => {
    const car: SpecSource = {
      ...bare,
      engine: '3.0L flat-six',
      horsepower: 450,
      torque_nm: 530,
      acceleration_0_100: 3.5,
      top_speed_kmh: 308,
      fuel_type: 'Petrol',
      doors: 2,
      origin_country: 'Germany',
    }
    const { container } = render(<VehicleHighlights vehicle={car} />)

    expect(container.querySelectorAll('dl > div')).toHaveLength(5)
    expect(screen.queryByText('Petrol')).not.toBeInTheDocument()
    expect(screen.queryByText('Germany')).not.toBeInTheDocument()
  })

  it('renders nothing at all when there is nothing real to show', () => {
    const { container } = render(<VehicleHighlights vehicle={bare} />)
    expect(container).toBeEmptyDOMElement()
  })
})
