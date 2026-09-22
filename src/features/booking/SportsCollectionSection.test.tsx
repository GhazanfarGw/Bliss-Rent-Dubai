import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SportsCollectionSection } from '@/features/booking/SportsCollectionSection'
import type { VehicleWithDetails } from '@/types/domain'

function vehicle(id: string, categoryName: string, make: string, model: string, price: number): VehicleWithDetails {
  return {
    id,
    category_id: `cat-${categoryName}`,
    make,
    model,
    model_year: 2025,
    transmission: 'automatic',
    seats: 2,
    status: 'available',
    created_at: '2026-01-01T00:00:00Z',
    vehicle_categories: { id: `cat-${categoryName}`, name: categoryName, description: null },
    vehicle_images: [{ id: `img-${id}`, vehicle_id: id, storage_path: `${id}/main.jpg`, is_primary: true, sort_order: 0 }],
    pricing: [{ id: `price-${id}`, vehicle_id: id, term: 'daily', list_price: price + 100, client_price: price, currency: 'AED' }],
  } as unknown as VehicleWithDetails
}

function renderSection(vehicles: VehicleWithDetails[]) {
  return render(
    <MemoryRouter>
      <SportsCollectionSection vehicles={vehicles} />
    </MemoryRouter>,
  )
}

describe('SportsCollectionSection', () => {
  it('stays off the homepage when no publishable sports cars exist', () => {
    renderSection([vehicle('economy-1', 'Economy', 'Toyota', 'Camry', 250)])
    expect(screen.queryByRole('heading', { name: 'Sports cars, built for the moment' })).not.toBeInTheDocument()
  })

  it('uses real sports inventory, pricing and links while excluding other categories', async () => {
    renderSection([
      vehicle('sports-1', 'Sports & Supercars', 'Ferrari', '488 Spider', 3200),
      vehicle('economy-1', 'Economy', 'Toyota', 'Camry', 250),
    ])

    const slide = screen.getByRole('article', { name: 'Sports car 1 of 1' })
    expect(within(slide).getByRole('heading', { name: '488 Spider' })).toBeInTheDocument()
    // The literal "AED" text was replaced by the CurrencySymbol component (an
    // inline SVG dirham glyph) — only the number is now plain text content.
    expect(within(slide).getByText(/3,200/)).toBeInTheDocument()
    expect(within(slide).getByRole('link', { name: /view this car/i })).toHaveAttribute('href', '/vehicles/sports-1')
    expect(screen.queryByText('Toyota')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view sports fleet/i })).toHaveAttribute('href', '/search?category=cat-Sports%20%26%20Supercars')
  })

  it('changes the active car with the carousel controls', async () => {
    const user = userEvent.setup()
    renderSection([
      vehicle('sports-1', 'Sports & Supercars', 'Ferrari', '488 Spider', 3200),
      vehicle('sports-2', 'Sports & Supercars', 'Lamborghini', 'Huracan EVO', 3500),
    ])

    const first = screen.getByRole('article', { name: 'Sports car 1 of 2' })
    const second = screen.getByRole('article', { name: 'Sports car 2 of 2' })
    expect(first).toHaveAttribute('aria-current', 'true')
    expect(second).not.toHaveAttribute('aria-current')

    await user.click(screen.getByRole('button', { name: 'Next sports car' }))

    expect(first).not.toHaveAttribute('aria-current')
    expect(second).toHaveAttribute('aria-current', 'true')
  })
})
