import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { VehicleCard } from '@/features/booking/VehicleCard'
import type { VehicleWithDetails } from '@/types/domain'

const vehicle = {
  id: 'vehicle-1',
  make: 'Toyota',
  model: 'Camry',
  model_year: 2024,
  transmission: 'automatic',
  seats: 5,
  vehicle_categories: { id: 'cat-1', name: 'Sedan', description: null },
  vehicle_images: [],
  pricing: [{ id: 'price-1', vehicle_id: 'vehicle-1', term: 'daily', list_price: 180, client_price: 149, currency: 'AED' }],
} as unknown as VehicleWithDetails

function renderCard(isAvailable = true) {
  return render(
    <MemoryRouter>
      <VehicleCard vehicle={vehicle} days={7} detailHref="/vehicles/vehicle-1" isAvailable={isAvailable} />
    </MemoryRouter>,
  )
}

describe('VehicleCard', () => {
  it('shows real vehicle metadata, quote, and booking actions', () => {
    renderCard()

    expect(screen.getByRole('heading', { name: 'Toyota Camry' })).toBeInTheDocument()
    expect(screen.getByText('Sedan')).toBeInTheDocument()
    expect(screen.getByText(/149/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /book now/i })).toHaveAttribute('href', '/vehicles/vehicle-1')
    expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute('href', '/vehicles/vehicle-1')
  })

  it('makes reserved vehicles visible but does not offer booking', () => {
    renderCard(false)

    expect(screen.getByText('Reserved')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /book now/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view details/i })).toBeInTheDocument()
  })

  it('always offers a direct WhatsApp contact link, using the centralized contact number', () => {
    renderCard()

    const whatsappLink = screen.getByRole('link', { name: /whatsapp/i })
    expect(whatsappLink).toHaveAttribute('href', expect.stringContaining('https://wa.me/971547820057'))
    expect(whatsappLink).toHaveAttribute('target', '_blank')
  })

  it('shows a quantity badge when this card represents a group of identical master listings', () => {
    render(
      <MemoryRouter>
        <VehicleCard vehicle={vehicle} days={7} detailHref="/vehicles/vehicle-1" isAvailable quantity={4} />
      </MemoryRouter>,
    )

    expect(screen.getByText('4 available')).toBeInTheDocument()
  })

  it('shows no quantity badge for a single (non-grouped) listing', () => {
    renderCard()

    expect(screen.queryByText(/available$/)).not.toBeInTheDocument()
  })
})
