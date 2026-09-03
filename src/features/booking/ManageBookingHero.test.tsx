import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ManageBookingHero } from '@/features/booking/ManageBookingHero'

describe('ManageBookingHero', () => {
  it('shows the real Manage Booking title and subtitle — no invented copy', () => {
    render(<ManageBookingHero />)
    expect(screen.getByRole('heading', { level: 1, name: 'Find My Car' })).toBeInTheDocument()
    expect(screen.getByText(/enter your booking reference or vehicle plate number/i)).toBeInTheDocument()
  })

  it('renders a real hero photo, not a placeholder', () => {
    render(<ManageBookingHero />)
    const img = screen.getByRole('img')
    expect(img.tagName).toBe('IMG')
    expect(img.getAttribute('src')).toBeTruthy()
  })
})
