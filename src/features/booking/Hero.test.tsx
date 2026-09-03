import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Hero } from '@/features/booking/Hero'

describe('Hero', () => {
  it('renders a single static hero image with its heading and CTA', () => {
    render(<Hero />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('loading', 'eager')

    expect(screen.getByRole('button', { name: /book now/i })).toBeInTheDocument()
  })

  it('does not render any carousel controls (dots, arrows, slide counter)', () => {
    render(<Hero />)

    expect(screen.queryByRole('region', { name: /carousel/i })).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /go to slide/i })).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /previous slide/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next slide/i })).not.toBeInTheDocument()
  })
})
