import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FindMyCarHero } from '@/features/booking/FindMyCarHero'

describe('FindMyCarHero', () => {
  it('shows the real Booking Status title and subtitle — no invented copy', () => {
    render(<FindMyCarHero />)
    expect(screen.getByRole('heading', { level: 1, name: 'Booking Status' })).toBeInTheDocument()
    expect(screen.getByText(/enter your booking reference to check your reservation status/i)).toBeInTheDocument()
  })

  it('renders a real hero photo, not a placeholder', () => {
    render(<FindMyCarHero />)
    const img = screen.getByRole('img')
    expect(img.tagName).toBe('IMG')
    expect(img.getAttribute('src')).toBeTruthy()
  })
})
