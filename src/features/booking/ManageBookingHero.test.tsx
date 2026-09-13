import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ManageBookingHero } from '@/features/booking/ManageBookingHero'

describe('ManageBookingHero', () => {
  it('shows the real Manage Booking eyebrow and instructional heading — no invented copy', () => {
    render(<ManageBookingHero />)
    expect(screen.getByText('Manage Booking')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: /booking reference or vehicle plate number and last name/i }),
    ).toBeInTheDocument()
  })

  it('is a plain flat header — no hero photo', () => {
    render(<ManageBookingHero />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
