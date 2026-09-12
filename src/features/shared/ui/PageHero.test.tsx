import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHero } from '@/features/shared/ui/PageHero'

describe('PageHero', () => {
  it('renders the given image, badge, title, and subtitle — nothing invented', () => {
    render(<PageHero imageSrc="/fleet/sedan.webp" imageAlt="A sedan" badge="Reserve online" title="Book Your Car" subtitle="Pick your dates." />)

    const img = screen.getByRole('img', { name: 'A sedan' })
    expect(img).toHaveAttribute('src', '/fleet/sedan.webp')
    expect(screen.getByText('Reserve online')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Book Your Car' })).toBeInTheDocument()
    expect(screen.getByText('Pick your dates.')).toBeInTheDocument()
  })
})
