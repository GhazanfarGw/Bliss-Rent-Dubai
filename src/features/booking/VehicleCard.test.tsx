import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
    // One link is the whole card's target — no second, identical "View details".
    expect(screen.queryByRole('link', { name: /view details/i })).not.toBeInTheDocument()
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

  it.each(['Luxury', 'Economy'])('shows just the plain "%s" category chip — no rank medal or "Premium" label', (categoryName) => {
    const car = {
      ...vehicle,
      vehicle_categories: { id: 'cat-x', name: categoryName, description: null },
    } as unknown as VehicleWithDetails
    render(
      <MemoryRouter>
        <VehicleCard vehicle={car} detailHref="/vehicles/vehicle-1" isAvailable />
      </MemoryRouter>,
    )

    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getAllByText(categoryName)).toHaveLength(1)
    expect(screen.queryByText('Premium')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /premium|economy|luxury/i })).not.toBeInTheDocument()
    expect(document.querySelector('[data-rank]')).toBeNull()
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

  it('offers a persistent website Book now plus a single WhatsApp icon (no hover-only CTA)', () => {
    render(
      <MemoryRouter>
        <VehicleCard vehicle={vehicle} detailHref="/vehicles/vehicle-1" isAvailable />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /book now/i })).toHaveAttribute('href', '/vehicles/vehicle-1')

    const whatsappLink = screen.getByRole('link', { name: /whatsapp/i })
    expect(whatsappLink).toHaveAttribute('href', expect.stringContaining('https://wa.me/971547820057'))
    expect(whatsappLink).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('Toyota Camry')))
    expect(whatsappLink).toHaveAttribute('target', '_blank')
  })

  it('focusable={false} keeps every link clickable but removes it from the keyboard tab order', () => {
    render(
      <MemoryRouter>
        <VehicleCard vehicle={vehicle} detailHref="/vehicles/vehicle-1" isAvailable focusable={false} />
      </MemoryRouter>,
    )

    for (const name of [/book now/i, /whatsapp/i]) {
      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute('tabindex', '-1')
      expect(link).toHaveAttribute('href')
    }
  })

  it('leaves every link in the tab order by default', () => {
    renderCard()
    for (const name of [/book now/i, /whatsapp/i]) {
      expect(screen.getByRole('link', { name })).not.toHaveAttribute('tabindex')
    }
  })

  it('badges a small "Available" on the photo, shows the category once, and a stacked "From" price when there are no dates', () => {
    render(
      <MemoryRouter>
        <VehicleCard vehicle={vehicle} detailHref="/vehicles/vehicle-1" isAvailable />
      </MemoryRouter>,
    )

    const badge = screen.getByText('Available')
    expect(badge).toHaveClass('text-[10px]', 'font-medium')
    expect(screen.getAllByText('Sedan')).toHaveLength(1)
    expect(screen.getByText('From')).toBeInTheDocument()
    // The literal "AED" text was replaced by the CurrencySymbol component (an
    // inline SVG dirham glyph) — only the number is now plain text content.
    expect(screen.getByText(/149/)).toBeInTheDocument()
  })
})

describe('VehicleCard — layout', () => {
  function renderCard2(props: { isAvailable?: boolean; days?: number; quantity?: number } = {}) {
    return render(
      <MemoryRouter>
        <VehicleCard vehicle={vehicle} detailHref="/vehicles/vehicle-1" isAvailable={props.isAvailable ?? true} days={props.days} quantity={props.quantity} />
      </MemoryRouter>,
    )
  }

  it('badges the photo "Available" — with or without dates', () => {
    const { unmount } = renderCard2()
    expect(screen.getByText('Available')).toBeInTheDocument()
    unmount()

    renderCard2({ days: 3 })
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('badges a reserved car "Reserved" instead', () => {
    renderCard2({ isAvailable: false })
    expect(screen.getByText('Reserved')).toBeInTheDocument()
    expect(screen.queryByText('Available')).not.toBeInTheDocument()
  })

  it('shows the category beside the make, and the model year down with seats and transmission', () => {
    renderCard2()

    expect(screen.getAllByText('Sedan')).toHaveLength(1)
    const specs = within(screen.getByText('Year').closest('dl') as HTMLElement)
    expect(specs.getByText('5 seats')).toBeInTheDocument()
    expect(specs.getByText('Automatic')).toBeInTheDocument()
    expect(specs.getByText('2024')).toBeInTheDocument()
    // Not next to the make any more.
    expect(screen.getByText('Toyota').parentElement).not.toHaveTextContent('2024')
  })

  it('has a single link to the vehicle, so the whole card is one target', () => {
    renderCard2()
    expect(screen.getAllByRole('link', { name: /book now/i })).toHaveLength(1)
    expect(screen.queryByRole('link', { name: /view details/i })).not.toBeInTheDocument()
  })

  it('shows the engine on its own line when one is recorded, with the full text as a tooltip', () => {
    const car = { ...vehicle, engine: '4.0L twin-turbo V8' } as unknown as VehicleWithDetails
    render(
      <MemoryRouter>
        <VehicleCard vehicle={car} detailHref="/vehicles/vehicle-1" isAvailable />
      </MemoryRouter>,
    )
    const engine = screen.getByText('4.0L twin-turbo V8')
    expect(engine).toHaveAttribute('title', '4.0L twin-turbo V8')
    expect(engine).toHaveClass('truncate')
    expect(within(engine.closest('dl') as HTMLElement).getByText('Engine')).toBeInTheDocument()
  })

  it('shows no engine line — and no placeholder — when none is recorded', () => {
    renderCard2()
    expect(screen.queryByText('Engine')).not.toBeInTheDocument()
  })

  it('moves the group-size badge onto the photo', () => {
    renderCard2({ quantity: 4 })
    expect(screen.getByText('4 available')).toBeInTheDocument()
  })

  it('sets the model name simply — plain sans, medium weight, one line — with the full name as a tooltip', () => {
    renderCard2()
    const heading = screen.getByRole('heading', { name: 'Toyota Camry' })
    expect(heading).not.toHaveClass('font-hero-serif')
    expect(heading).toHaveClass('font-medium', 'truncate')
    expect(heading).toHaveAttribute('title', 'Toyota Camry')
  })
})

describe('VehicleCard — hover', () => {
  it('the link that carries the card-wide hit area never gets a filter or transform, which would shrink that hit area on hover and make the cursor flicker', () => {
    renderCard()
    const link = screen.getByRole('link', { name: /book now/i })
    expect(link.className).toContain('after:inset-0')
    // `filter`/`transform`-type utilities turn the link into the containing block of its ::after.
    expect(link.className).not.toMatch(/brightness|blur|contrast|saturate|grayscale|drop-shadow|filter|scale|translate|rotate|skew|perspective|transition-all/)
  })

  it('the card does not lift on hover (a moving card makes the cursor flicker at its edge)', () => {
    const { container } = render(
      <MemoryRouter>
        <VehicleCard vehicle={vehicle} detailHref="/vehicles/vehicle-1" isAvailable />
      </MemoryRouter>,
    )
    expect((container.firstChild as HTMLElement).className).not.toMatch(/translate/)
  })
})
