import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchWidget } from '@/features/booking/SearchWidget'

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

/** Opens a location picker sheet (by its placeholder/current-value button text) and clicks a named option inside it. */
async function pickLocation(user: ReturnType<typeof userEvent.setup>, triggerName: RegExp, optionName: RegExp) {
  await user.click(screen.getByRole('button', { name: triggerName }))
  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: optionName }))
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
    {
      id: 'loc-auh-airport',
      name: 'Abu Dhabi International Airport (AUH)',
      type: 'airport',
      city: 'Abu Dhabi',
      country: 'United Arab Emirates',
      airport_code: 'AUH',
      is_active: true,
      created_at: '',
    },
  ]),
}))

describe('SearchWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and shows every Dubai location (any type) in the Pickup picker', async () => {
    const user = userEvent.setup()
    render(<SearchWidget onSearch={vi.fn()} />)
    await screen.findByRole('button', { name: /select pickup point/i })

    await user.click(screen.getByRole('button', { name: /select pickup point/i }))
    const pickupDialog = screen.getByRole('dialog')
    expect(within(pickupDialog).getByRole('button', { name: /DXB Terminal 3/ })).toBeInTheDocument()
    expect(within(pickupDialog).getByRole('button', { name: /Downtown Dubai/ })).toBeInTheDocument()
  })

  it('defaults to a separate return location so the full trip is explicit', async () => {
    render(<SearchWidget onSearch={vi.fn()} />)
    await screen.findByRole('button', { name: /select pickup point/i })

    expect(screen.getByRole('checkbox', { name: /same return location/i })).not.toBeChecked()
    expect(screen.getByRole('button', { name: /select return point/i })).toBeInTheDocument()
  })

  it('offers every UAE location in the default Return Location field, not just the pickup city', async () => {
    const user = userEvent.setup()
    render(<SearchWidget onSearch={vi.fn()} />)
    await screen.findByRole('button', { name: /select pickup point/i })

    // Pickup stays in Dubai; the separate return picker still offers Abu Dhabi.
    await user.click(screen.getByRole('button', { name: /select return point/i }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /Abu Dhabi International Airport \(AUH\)/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /DXB Terminal 3/ })).toBeInTheDocument()
  })

  describe('layout="row" (homepage search bar)', () => {
    it('stacks the fields on small screens and joins them into one bar from lg up', async () => {
      const user = userEvent.setup()
      render(<SearchWidget onSearch={vi.fn()} compact layout="row" />)
      await screen.findByRole('button', { name: /select pickup point/i })

      const form = screen.getByRole('button', { name: /search cars/i }).closest('form') as HTMLFormElement
      const bar = form.firstElementChild as HTMLElement
      const searchButton = screen.getByRole('button', { name: /search cars/i })

      expect(bar).toHaveClass('flex-col')
      expect(bar).toHaveClass('lg:flex-row')
      expect(searchButton).toHaveClass('w-full')
      expect(searchButton).toHaveClass('sm:w-auto')

      await user.click(screen.getByRole('button', { name: /search cars/i }))
      expect(await screen.findByText('Please choose a pickup date.')).toBeInTheDocument()
    })

    it('uses custom dropdowns (not native selects) for pickup city and time', async () => {
      const user = userEvent.setup()
      render(<SearchWidget onSearch={vi.fn()} layout="row" />)
      await screen.findByRole('button', { name: /select pickup point/i })

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /pickup time/i }))
      const list = screen.getByRole('listbox', { name: /pickup time/i })
      expect(within(list).getByRole('option', { name: '10:00 AM' })).toHaveAttribute('aria-selected', 'true')
    })

    it('groups locations under type headings and guides on to the next field after a choice', async () => {
      const user = userEvent.setup()
      render(<SearchWidget onSearch={vi.fn()} layout="row" />)
      await screen.findByRole('button', { name: /select pickup point/i })

      await user.click(screen.getByRole('button', { name: /select pickup point/i }))
      const pickup = screen.getByRole('dialog')
      expect(within(pickup).getByText('Airport')).toBeInTheDocument()
      expect(within(pickup).getByText('City / Area')).toBeInTheDocument()
      await user.click(within(pickup).getByRole('button', { name: /DXB Terminal 3/ }))

      // Return location opens by itself next.
      expect(within(screen.getByRole('dialog')).getByRole('button', { name: /Abu Dhabi International Airport \(AUH\)/ })).toBeInTheDocument()
    })
  })

  it('shows a validation message and does not call onSearch when submitted empty', async () => {
    const onSearch = vi.fn()
    const user = userEvent.setup()
    render(<SearchWidget onSearch={onSearch} />)
    await screen.findByRole('button', { name: /select pickup point/i })

    await user.click(screen.getByRole('button', { name: /search cars/i }))

    expect(await screen.findByText('Please choose a pickup date.')).toBeInTheDocument()
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('calls onSearch with the entered criteria (same return location, default pickup time) once the form is valid', async () => {
    const onSearch = vi.fn()
    const user = userEvent.setup()
    render(<SearchWidget onSearch={onSearch} />)
    await screen.findByRole('button', { name: /select pickup point/i })
    await user.click(screen.getByRole('checkbox', { name: /same return location/i }))

    const startIso = futureIso(2)
    const endIso = futureIso(5)
    await user.click(document.querySelector('button[aria-haspopup="dialog"]') as HTMLElement)
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: fullDateLabel(startIso) }))
    await user.click(within(dialog).getByRole('button', { name: fullDateLabel(endIso) }))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    await pickLocation(user, /select pickup point/i, /DXB Terminal 3/)

    await user.click(screen.getByRole('button', { name: /search cars/i }))

    await waitFor(() =>
      expect(onSearch).toHaveBeenCalledWith({
        startDate: startIso,
        endDate: endIso,
        pickupLocationId: 'loc-airport',
        dropoffLocationId: 'loc-airport',
        pickupTime: '10:00',
      }),
    )
  })

  it('calls onSearch with an independent drop-off location by default', async () => {
    const onSearch = vi.fn()
    const user = userEvent.setup()
    render(<SearchWidget onSearch={onSearch} />)
    await screen.findByRole('button', { name: /select pickup point/i })

    const startIso = futureIso(2)
    const endIso = futureIso(5)
    await user.click(document.querySelector('button[aria-haspopup="dialog"]') as HTMLElement)
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: fullDateLabel(startIso) }))
    await user.click(within(dialog).getByRole('button', { name: fullDateLabel(endIso) }))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    await pickLocation(user, /select pickup point/i, /DXB Terminal 3/)

    await pickLocation(user, /select return point/i, /Abu Dhabi International Airport \(AUH\)/)

    await user.click(screen.getByRole('button', { name: /search cars/i }))

    await waitFor(() =>
      expect(onSearch).toHaveBeenCalledWith({
        startDate: startIso,
        endDate: endIso,
        pickupLocationId: 'loc-airport',
        dropoffLocationId: 'loc-auh-airport',
        pickupTime: '10:00',
      }),
    )
  })

  describe('layout="card" (BookCarPage)', () => {
    it('renders the same fields, sectioned, and still finds a real location', async () => {
      const user = userEvent.setup()
      render(<SearchWidget onSearch={vi.fn()} layout="card" />)
      await screen.findByRole('button', { name: /select pickup point/i })

      expect(screen.getByText('Pickup & return')).toBeInTheDocument()
      expect(screen.getByText('Dates & time')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /select pickup point/i }))
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByRole('button', { name: /DXB Terminal 3/ })).toBeInTheDocument()
    })

    it('calls onSearch with the same criteria shape as the other layouts', async () => {
      const onSearch = vi.fn()
      const user = userEvent.setup()
      render(<SearchWidget onSearch={onSearch} layout="card" />)
      await screen.findByRole('button', { name: /select pickup point/i })
      await user.click(screen.getByRole('checkbox', { name: /same return location/i }))

      const startIso = futureIso(2)
      const endIso = futureIso(5)
      await user.click(document.querySelector('button[aria-haspopup="dialog"]') as HTMLElement)
      const dateDialog = screen.getByRole('dialog')
      await user.click(within(dateDialog).getByRole('button', { name: fullDateLabel(startIso) }))
      await user.click(within(dateDialog).getByRole('button', { name: fullDateLabel(endIso) }))
      await user.click(within(dateDialog).getByRole('button', { name: 'Done' }))

      await pickLocation(user, /select pickup point/i, /DXB Terminal 3/)
      await user.click(screen.getByRole('button', { name: /search cars/i }))

      await waitFor(() =>
        expect(onSearch).toHaveBeenCalledWith({
          startDate: startIso,
          endDate: endIso,
          pickupLocationId: 'loc-airport',
          dropoffLocationId: 'loc-airport',
          pickupTime: '10:00',
        }),
      )
    })
  })

  describe('layout="navigator" (homepage)', () => {
    it('uses the guided two-section layout and keeps the return point visible by default', async () => {
      render(<SearchWidget onSearch={vi.fn()} layout="navigator" />)
      await screen.findByRole('button', { name: /select pickup point/i })

      expect(screen.getByText('Pickup & return')).toBeInTheDocument()
      expect(screen.getByText('Dates & time')).toBeInTheDocument()
      expect(screen.getByText(/choose exactly where your car journey starts and ends/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select return point/i })).toBeInTheDocument()
    })
  })
})
