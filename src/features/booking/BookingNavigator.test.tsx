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

  describe('mobile accordion', () => {
    it('shows four closed accordion rows by default', () => {
      renderNavigator()

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      const accordionButtons = screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-controls'))
      expect(accordionButtons).toHaveLength(4)
      expect(accordionButtons.every((button) => button.getAttribute('aria-expanded') === 'false')).toBe(true)
    })

    it('opens and closes a section, with only one panel open at a time', async () => {
      const user = userEvent.setup()
      renderNavigator()

      const searchRow = screen.getAllByRole('button', { name: /^search cars$/i }).find((button) => button.hasAttribute('aria-controls'))
      const manageRow = screen.getAllByRole('button', { name: /^manage booking$/i }).find((button) => button.hasAttribute('aria-controls'))
      expect(searchRow).toBeDefined()
      expect(manageRow).toBeDefined()

      await user.click(searchRow!)
      expect(searchRow).toHaveAttribute('aria-expanded', 'true')
      expect(document.getElementById('booking-panel-search')).toBeInTheDocument()

      await user.click(manageRow!)
      expect(searchRow).toHaveAttribute('aria-expanded', 'false')
      expect(manageRow).toHaveAttribute('aria-expanded', 'true')
      expect(document.getElementById('booking-panel-search')).not.toBeInTheDocument()
      expect(document.getElementById('booking-panel-manage')).toBeInTheDocument()

      await user.click(manageRow!)
      expect(manageRow).toHaveAttribute('aria-expanded', 'false')
    })

    it('opens and closes the Booking Status and Contact panels', async () => {
      const user = userEvent.setup()
      renderNavigator()

      const statusRow = screen.getAllByRole('button', { name: /^booking status$/i }).find((button) => button.hasAttribute('aria-controls'))
      const contactRow = screen.getAllByRole('button', { name: /^contact$/i }).find((button) => button.hasAttribute('aria-controls'))
      expect(statusRow).toBeDefined()
      expect(contactRow).toBeDefined()

      await user.click(statusRow!)
      expect(statusRow).toHaveAttribute('aria-expanded', 'true')
      expect(document.getElementById('booking-panel-status')).toBeInTheDocument()
      expect(screen.getByText(/check booking status/i)).toBeInTheDocument()

      await user.click(contactRow!)
      expect(statusRow).toHaveAttribute('aria-expanded', 'false')
      expect(contactRow).toHaveAttribute('aria-expanded', 'true')
      expect(document.getElementById('booking-panel-contact')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /whatsapp/i })).toBeInTheDocument()

      await user.click(contactRow!)
      expect(contactRow).toHaveAttribute('aria-expanded', 'false')
    })

    it('desktop tab selection remains independent from mobile accordion state', async () => {
      const user = userEvent.setup()
      renderNavigator()
      const nav = screen.getByRole('navigation', { name: /booking navigator/i })

      await user.click(within(nav).getByRole('button', { name: /manage booking/i }))

      expect(within(nav).getByRole('button', { name: /manage booking/i })).toHaveAttribute('aria-current', 'page')
    })
  })
})
