import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardSection } from './Card'
import { DetailRow } from './DetailRow'
import { PageContainer } from './PageContainer'
import { SectionHeader } from './SectionHeader'

describe('Card', () => {
  it('renders children inside the card surface, plus optional Header/Section slots', () => {
    render(
      <Card>
        <CardHeader>
          <h2>Booking BLS-1234</h2>
        </CardHeader>
        <CardSection>Details go here</CardSection>
      </Card>,
    )
    expect(screen.getByText('Booking BLS-1234')).toBeInTheDocument()
    expect(screen.getByText('Details go here')).toBeInTheDocument()
  })
})

describe('DetailRow', () => {
  it('renders the label and value', () => {
    render(<DetailRow label="Vehicle" value="Toyota Camry" />)
    expect(screen.getByText('Vehicle')).toBeInTheDocument()
    expect(screen.getByText('Toyota Camry')).toBeInTheDocument()
  })

  it('falls back to an em dash when value is null/undefined', () => {
    render(<DetailRow label="Driver" value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('PageContainer', () => {
  it('renders its children', () => {
    render(
      <PageContainer>
        <p>Page body</p>
      </PageContainer>,
    )
    expect(screen.getByText('Page body')).toBeInTheDocument()
  })
})

describe('SectionHeader', () => {
  it('renders title, description, and action; defaults to an h1', () => {
    render(<SectionHeader title="Bookings" description="All reservations" action={<button type="button">New</button>} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Bookings' })).toBeInTheDocument()
    expect(screen.getByText('All reservations')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
  })

  it('renders an h2 when as="h2" is passed', () => {
    render(<SectionHeader title="Nested section" as="h2" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Nested section' })).toBeInTheDocument()
  })
})
