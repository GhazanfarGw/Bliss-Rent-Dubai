import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { CheckoutSummaryCard } from './CheckoutSummaryCard'
import type { VehicleWithDetails } from '@/types/domain'

const vehicle = {
  make: 'Mercedes-Benz',
  model: 'S-Class',
  model_year: 2025,
  transmission: 'automatic',
  horsepower: 429,
  engine: '3.0L turbo',
  vehicle_images: [],
  pricing: [{ term: 'daily', list_price: 100, client_price: 100, currency: 'AED' }],
} as unknown as VehicleWithDetails

const props = {
  vehicle,
  startDate: '2026-10-01',
  endDate: '2026-10-03',
  pickup: null,
  dropoff: null,
}

describe('CheckoutSummaryCard', () => {
  it('provides a reversible details disclosure while keeping the car, duration and total outside it', () => {
    render(<CheckoutSummaryCard {...props} />)

    const toggle = screen.getByRole('button', { name: 'View Details' })
    const details = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(details).getByText('429 hp')).toBeInTheDocument()
    expect(within(details).getByText('2026-10-01')).toBeInTheDocument()
    expect(details).not.toContainElement(screen.getByRole('heading', { name: 'Mercedes-Benz S-Class' }))
    expect(details).not.toContainElement(screen.getByText('3 days'))
    expect(details).not.toContainElement(screen.getByText('300'))

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('300')).toBeInTheDocument()
  })

  it('uses the supplied booking total and detail without showing a conflicting estimate', () => {
    render(<CheckoutSummaryCard {...props} total={{ label: 'Amount due', amount: 250, currency: 'AED', detail: 'Confirmed booking total' }} />)

    expect(screen.getByText('Amount due')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getByText('Confirmed booking total')).toBeInTheDocument()
    expect(screen.queryByText('Estimated total')).not.toBeInTheDocument()
    expect(screen.queryByText(/estimated, confirmed at checkout/)).not.toBeInTheDocument()
    expect(screen.queryByText('300')).not.toBeInTheDocument()
  })

  it('does not replace a confirmed zero balance with a rental estimate', () => {
    render(<CheckoutSummaryCard {...props} total={{ label: 'Amount due', amount: 0, currency: 'AED' }} />)

    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.queryByText('300')).not.toBeInTheDocument()
  })
})
