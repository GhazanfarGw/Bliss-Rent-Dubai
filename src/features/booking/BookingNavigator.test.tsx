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

  it('renders exactly the four required tabs, Search Cars active by default', () => {
    renderNavigator()
    const nav = screen.getByRole('navigation', { name: /booking navigator/i })
    const tabButtons = within(nav).getAllByRole('button')
    expect(tabButtons).toHaveLength(4)
    expect(within(nav).getByRole('button', { name: /search cars/i })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('button', { name: /manage booking/i })).not.toHaveAttribute('aria-current')
    expect(within(nav).getByRole('button', { name: /booking status/i })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: /^contact/i })).toBeInTheDocument()
  })

  it('switches the active panel and aria-current when a desktop tab is clicked', async () => {
    const user = userEvent.setup()
    renderNavigator()
    const nav = screen.getByRole('navigation', { name: /booking navigator/i })

    await user.click(within(nav).getByRole('button', { name: /booking status/i }))

    expect(within(nav).getByRole('button', { name: /booking status/i })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('button', { name: /search cars/i })).not.toHaveAttribute('aria-current')
    expect(screen.getByText(/check booking status/i)).toBeInTheDocument()
  })

  describe('mobile dropdown', () => {
    it('is closed by default and opens exactly one menu on click', async () => {
      const user = userEvent.setup()
      renderNavigator()

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

      const trigger = screen.getByRole('button', { name: /booking menu: search cars/i })
      await user.click(trigger)

      expect(screen.getByRole('listbox', { name: /booking menu/i })).toBeInTheDocument()
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
      expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(4)
    })

    it('selecting an option switches the panel and closes the menu automatically', async () => {
      const user = userEvent.setup()
      renderNavigator()

      await user.click(screen.getByRole('button', { name: /booking menu: search cars/i }))
      await user.click(screen.getByRole('option', { name: /^contact/i }))

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /booking menu: contact/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /whatsapp/i })).toBeInTheDocument()
    })

    it('closes on Escape without changing the active tab', async () => {
      const user = userEvent.setup()
      renderNavigator()

      await user.click(screen.getByRole('button', { name: /booking menu: search cars/i }))
      expect(screen.getByRole('listbox')).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /booking menu: search cars/i })).toBeInTheDocument()
    })

    it('closes when clicking outside the menu', async () => {
      const user = userEvent.setup()
      renderNavigator()

      await user.click(screen.getByRole('button', { name: /booking menu: search cars/i }))
      expect(screen.getByRole('listbox')).toBeInTheDocument()

      await user.click(document.body)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('switching tabs from the desktop bar updates the mobile trigger label too', async () => {
      const user = userEvent.setup()
      renderNavigator()
      const nav = screen.getByRole('navigation', { name: /booking navigator/i })

      await user.click(within(nav).getByRole('button', { name: /manage booking/i }))

      expect(screen.getByRole('button', { name: /booking menu: manage booking/i })).toBeInTheDocument()
    })
  })
})
