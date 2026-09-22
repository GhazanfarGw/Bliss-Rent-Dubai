import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ManageBookingHero } from '@/features/booking/ManageBookingHero'

function renderHero() {
  return render(
    <ManageBookingHero
      query=""
      onQueryChange={vi.fn()}
      lastName=""
      onLastNameChange={vi.fn()}
      onSubmit={vi.fn()}
      loading={false}
      notFound={false}
      errorMessage={null}
    />,
  )
}

describe('ManageBookingHero', () => {
  it('shows the real Manage Booking eyebrow, heading, and trust bullets — no invented copy', () => {
    renderHero()
    expect(screen.getByText('Manage Booking')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Manage Your Booking' })).toBeInTheDocument()
    expect(screen.getByText('No account needed')).toBeInTheDocument()
    expect(screen.getByText('Instant results')).toBeInTheDocument()
    expect(screen.getByText('Secure & private')).toBeInTheDocument()
  })

  it('is a branded band — no stock hero photo', () => {
    renderHero()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('embeds the lookup form, passing props straight through', () => {
    renderHero()
    expect(screen.getByPlaceholderText('Booking Reference or Vehicle Plate Number')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Last Name')).toBeInTheDocument()
  })
})
