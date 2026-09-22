import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { BookCarPage } from '@/features/booking/BookCarPage'

vi.mock('@/features/booking/api', () => ({
  fetchLocations: vi.fn().mockResolvedValue([
    {
      id: 'loc-airport',
      name: 'DXB Terminal 3',
      type: 'airport',
      city: 'Dubai',
      country: 'United Arab Emirates',
      airport_code: 'DXB',
      is_active: true,
      created_at: '',
    },
  ]),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/book']}>
      <Routes>
        <Route path="/book" element={<BookCarPage />} />
        <Route path="/search" element={<div>SEARCH RESULTS PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BookCarPage', () => {
  it('shows the real Book a Car hero copy', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Book Your Car' })).toBeInTheDocument()
  })

  it('renders the same SearchWidget fields, in the card layout', async () => {
    renderPage()
    await screen.findByRole('button', { name: /select pickup point/i })
    expect(screen.getByText('Pickup & return')).toBeInTheDocument()
  })

  it('submitting navigates to /search — same flow as the homepage, no new booking logic', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: /select pickup point/i })

    await user.click(screen.getByRole('button', { name: /select pickup point/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /DXB Terminal 3/ }))

    // A new search defaults to a separate return location — check "same
    // return location" so picking only a pickup point is enough to submit.
    await user.click(screen.getByRole('checkbox', { name: /same return location/i }))

    await user.click(document.querySelector('button[aria-haspopup="dialog"]') as HTMLElement)
    const dateDialog = screen.getByRole('dialog')
    const dayButtons = within(dateDialog).getAllByRole('button')
    // Just need two selectable days to form a valid range — exact dates
    // aren't the point of this test, only that submitting routes to /search.
    const enabledDayButtons = dayButtons.filter((b) => !b.hasAttribute('disabled') && /\d{4}/.test(b.getAttribute('aria-label') ?? ''))
    await user.click(enabledDayButtons[0])
    await user.click(enabledDayButtons[enabledDayButtons.length - 1])
    await user.click(within(dateDialog).getByRole('button', { name: 'Done' }))

    await user.click(screen.getByRole('button', { name: /search cars/i }))

    await waitFor(() => expect(screen.getByText('SEARCH RESULTS PAGE')).toBeInTheDocument())
  })
})
