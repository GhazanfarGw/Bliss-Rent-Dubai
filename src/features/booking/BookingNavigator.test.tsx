import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BookingNavigator } from '@/features/booking/BookingNavigator'

vi.mock('@/features/booking/api', () => ({
  fetchLocations: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/features/booking/lookupApi', () => ({
  lookupBooking: vi.fn(),
  BookingLookupError: class BookingLookupError extends Error {},
}))

function renderNavigator() {
  return render(
    <MemoryRouter>
      <BookingNavigator onSearch={vi.fn()} />
    </MemoryRouter>,
  )
}

describe('BookingNavigator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('presents two distinct customer goals with car search selected', async () => {
    renderNavigator()
    await screen.findByRole('button', { name: /select pickup point/i })

    const nav = screen.getByRole('navigation', { name: /booking navigator/i })
    const tabs = within(nav).getAllByRole('tab')

    expect(tabs).toHaveLength(2)
    expect(within(nav).getByRole('tab', { name: /search cars/i })).toHaveAttribute('aria-selected', 'true')
    expect(within(nav).getByRole('tab', { name: /manage booking/i })).toHaveAttribute('aria-selected', 'false')
    expect(within(nav).queryByRole('tab', { name: /get help/i })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('tab', { name: /booking status/i })).not.toBeInTheDocument()
  })

  it('opens the complete manage-booking lookup from one stable tab panel, with no separate heading above it', async () => {
    const user = userEvent.setup()
    renderNavigator()
    await screen.findByRole('button', { name: /select pickup point/i })

    const nav = screen.getByRole('navigation', { name: /booking navigator/i })
    await user.click(within(nav).getByRole('tab', { name: /manage booking/i }))

    expect(within(nav).getByRole('tab', { name: /manage booking/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('heading', { name: /manage your booking/i })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('BLS-XXXXXXXX')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/renter/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /select pickup point/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  })
})
