import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BookingSearchSection } from '@/features/booking/BookingSearchSection'

/** Dates relative to "today" — resilient to whenever these tests actually
 *  run, unlike a hardcoded future date. Mirrors the same helper in
 *  `DateRangePicker.test.tsx`. */
function futureIso(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The calendar's day buttons are labelled with their full accessible date (see DateRangePicker.tsx). */
function fullDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    calendar: 'gregory',
    numberingSystem: 'latn',
  }).format(new Date(y, m - 1, d))
}

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
    {
      id: 'loc-city',
      name: 'Downtown Dubai',
      type: 'city',
      city: 'Dubai',
      country: 'United Arab Emirates',
      airport_code: null,
      is_active: true,
      created_at: '',
    },
  ]),
}))

vi.mock('@/features/booking/lookupApi', () => ({
  lookupBooking: vi.fn(),
  BookingLookupError: class BookingLookupError extends Error {},
}))

describe('BookingSearchSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes #booking-section as an anchor/observer target and renders the real search form by default', async () => {
    const { container } = render(
      <MemoryRouter>
        <BookingSearchSection onSearch={vi.fn()} />
      </MemoryRouter>,
    )
    expect(container.querySelector('#booking-section')).not.toBeNull()
    expect(await screen.findByRole('button', { name: /select pickup point/i })).toBeInTheDocument()
  })

  it('renders the two focused booking navigator tabs, Search Cars active by default', async () => {
    render(
      <MemoryRouter>
        <BookingSearchSection onSearch={vi.fn()} />
      </MemoryRouter>,
    )
    await screen.findByRole('button', { name: /select pickup point/i })
    const nav = screen.getByRole('navigation', { name: /booking navigator/i })
    expect(within(nav).getAllByRole('tab')).toHaveLength(2)
    expect(within(nav).getByRole('tab', { name: /search cars/i })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('tab', { name: /manage booking/i })).toBeInTheDocument()
    expect(within(nav).queryByRole('tab', { name: /get help/i })).not.toBeInTheDocument()
  })

  it('switches to the Manage Booking panel (reference + last name), with no heading above it, when that tab is selected', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <BookingSearchSection onSearch={vi.fn()} />
      </MemoryRouter>,
    )
    await screen.findByRole('button', { name: /select pickup point/i })

    const nav = screen.getByRole('navigation', { name: /booking navigator/i })
    await user.click(within(nav).getByRole('tab', { name: /manage booking/i }))

    // The "Manage Your Booking" heading/description that used to sit above
    // this panel (BookingNavigator's PanelIntro) was dropped per a direct
    // follow-up request — the two real lookup fields are what confirms the
    // panel switched, via their current placeholders
    // (home.navigator.manage.referencePlaceholder/lastNamePlaceholder in
    // en.ts).
    expect(screen.queryByRole('heading', { name: /manage your booking/i })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('BLS-XXXXXXXX')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/renter/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /select pickup point/i })).not.toBeInTheDocument()
  })

  it('still calls onSearch with the entered criteria from the Search Cars panel — no duplicated booking logic', async () => {
    const onSearch = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <BookingSearchSection onSearch={onSearch} />
      </MemoryRouter>,
    )
    await screen.findByRole('button', { name: /select pickup point/i })

    const startIso = futureIso(2)
    const endIso = futureIso(5)
    await user.click(document.querySelector('button[aria-haspopup="dialog"]') as HTMLElement)
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: fullDateLabel(startIso) }))
    await user.click(within(dialog).getByRole('button', { name: fullDateLabel(endIso) }))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    await user.click(screen.getByRole('button', { name: /select pickup point/i }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /DXB Terminal 3/ }))

    await user.click(screen.getByRole('button', { name: /select return point/i }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Downtown Dubai/ }))

    // The default separate return picker keeps the drop-off choice explicit.
    // Scope the submit action to the SearchWidget form because the mobile
    // navigator row intentionally has the same visible label.
    await user.click(within(document.querySelector('form') as HTMLElement).getByRole('button', { name: /^search cars$/i }))

    await waitFor(() =>
      expect(onSearch).toHaveBeenCalledWith({
        startDate: startIso,
        endDate: endIso,
        pickupLocationId: 'loc-airport',
        dropoffLocationId: 'loc-city',
        pickupTime: '10:00',
      }),
    )
  })
})
