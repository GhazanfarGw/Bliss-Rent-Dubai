import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterRail, FilterToolbar, ResultsBar, SortField } from '@/features/booking/FilterBar'
import { EMPTY_FILTERS } from '@/types/domain'
import type { VehicleFilters } from '@/types/domain'

const options = {
  categories: [
    { id: 'sedan', name: 'Sedan' },
    { id: 'suv', name: 'SUV' },
  ],
  brands: ['Audi', 'BMW', 'Toyota'],
  transmissions: ['automatic', 'manual'],
  seatOptions: [2, 5, 7],
  priceBounds: { min: 150, max: 900 },
  currency: 'AED',
  facets: {
    category: { sedan: 4, suv: 2 },
    brand: { Audi: 1, BMW: 0, Toyota: 3 },
    transmission: { automatic: 5, manual: 1 },
    seats: { 2: 6, 5: 4, 7: 1 },
  },
  totalCount: 6,
  showAvailabilityFilter: true,
}

const onFiltersChange = vi.fn()
const onSortChange = vi.fn()
const props = { ...options, filters: EMPTY_FILTERS, sort: 'price_asc' as const, onFiltersChange, onSortChange }

beforeEach(() => {
  onFiltersChange.mockReset()
  onSortChange.mockReset()
})

const rail = () => screen.getByRole('complementary', { name: 'Filter fleet' })

describe('FilterRail', () => {
  it('lists every category with its car count and marks the active one', () => {
    render(<FilterRail {...props} filters={{ ...EMPTY_FILTERS, categoryId: 'suv' }} />)

    const list = within(rail())
    expect(list.getByRole('button', { name: /^All cars/ })).toHaveAttribute('aria-pressed', 'false')
    expect(list.getByRole('button', { name: /^Sedan/ })).toHaveTextContent('4')
    expect(list.getByRole('button', { name: /^SUV/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('filters by category, keeping the other filters', async () => {
    const user = userEvent.setup()
    render(<FilterRail {...props} filters={{ ...EMPTY_FILTERS, brands: ['Toyota'] }} />)

    await user.click(within(rail()).getByRole('button', { name: /^Sedan/ }))
    expect(onFiltersChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, brands: ['Toyota'], categoryId: 'sedan' })
  })

  it('lets several brands be ticked and unticked', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<FilterRail {...props} />)

    await user.click(within(rail()).getByRole('checkbox', { name: /Toyota/ }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, brands: ['Toyota'] })

    rerender(<FilterRail {...props} filters={{ ...EMPTY_FILTERS, brands: ['Toyota'] }} />)
    await user.click(within(rail()).getByRole('checkbox', { name: /Audi/ }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, brands: ['Toyota', 'Audi'] })

    await user.click(within(rail()).getByRole('checkbox', { name: /Toyota/ }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, brands: [] })
  })

  it('greys out a brand that would leave no cars, unless it is already ticked', () => {
    const { rerender } = render(<FilterRail {...props} />)
    expect(within(rail()).getByRole('checkbox', { name: /BMW/ })).toBeDisabled()

    rerender(<FilterRail {...props} filters={{ ...EMPTY_FILTERS, brands: ['BMW'] }} />)
    expect(within(rail()).getByRole('checkbox', { name: /BMW/ })).toBeEnabled()
  })

  it('offers a brand search only when the list is long, and narrows it as you type', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<FilterRail {...props} />)
    expect(within(rail()).queryByRole('searchbox')).not.toBeInTheDocument()

    const many = ['Audi', 'BMW', 'Bentley', 'Ferrari', 'Ford', 'Honda', 'Kia', 'Lexus', 'Toyota']
    const facets = { ...options.facets, brand: Object.fromEntries(many.map((brand) => [brand, 1])) }
    rerender(<FilterRail {...props} brands={many} facets={facets} />)
    await user.type(within(rail()).getByRole('searchbox', { name: 'Search brands' }), 'ben')

    expect(within(rail()).getByRole('checkbox', { name: /Bentley/ })).toBeInTheDocument()
    expect(within(rail()).queryByRole('checkbox', { name: /Toyota/ })).not.toBeInTheDocument()
  })

  it('sets transmission and a minimum seat count from the toggle buttons', async () => {
    const user = userEvent.setup()
    render(<FilterRail {...props} />)

    await user.click(within(within(rail()).getByRole('group', { name: 'Transmission' })).getByRole('button', { name: 'Manual' }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, transmission: 'manual' })

    await user.click(within(within(rail()).getByRole('group', { name: 'Seats' })).getByRole('button', { name: '5+' }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, minSeats: 5 })
  })

  it('needs no "2+" seat chip — the smallest count is what "Any" already means', () => {
    render(<FilterRail {...props} />)
    const seats = within(within(rail()).getByRole('group', { name: 'Seats' }))
    expect(seats.getAllByRole('button').map((b) => b.textContent)).toEqual(['Any', '5+', '7+'])
  })

  it('sets a per-day price range, using the fleet range as the hint', () => {
    render(<FilterRail {...props} />)

    expect(within(rail()).getByText('Fleet range: AED 150 – 900 per day')).toBeInTheDocument()
    fireEvent.change(within(rail()).getByLabelText('Min'), { target: { value: '200' } })
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, priceMin: 200 })

    fireEvent.change(within(rail()).getByLabelText('Max'), { target: { value: '500' } })
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, priceMax: 500 })
  })

  it('sets availability only when dates were searched', () => {
    const { rerender } = render(<FilterRail {...props} />)
    expect(within(rail()).getByRole('group', { name: 'Availability' })).toBeInTheDocument()

    rerender(<FilterRail {...props} showAvailabilityFilter={false} />)
    expect(within(rail()).queryByRole('group', { name: 'Availability' })).not.toBeInTheDocument()
  })

  it('leaves out a control that could not change anything', () => {
    render(<FilterRail {...props} transmissions={['automatic']} seatOptions={[5]} priceBounds={{ min: 300, max: 300 }} />)

    expect(within(rail()).queryByRole('group', { name: 'Transmission' })).not.toBeInTheDocument()
    expect(within(rail()).queryByRole('group', { name: 'Seats' })).not.toBeInTheDocument()
    expect(within(rail()).queryByLabelText('Min')).not.toBeInTheDocument()
  })

  it('shows a clear button only while filters are active, and clears them all', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<FilterRail {...props} />)
    expect(within(rail()).queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()

    const busy: VehicleFilters = { ...EMPTY_FILTERS, categoryId: 'suv', brands: ['Audi'], minSeats: 5 }
    rerender(<FilterRail {...props} filters={busy} />)
    await user.click(within(rail()).getByRole('button', { name: 'Clear filters' }))
    expect(onFiltersChange).toHaveBeenCalledWith(EMPTY_FILTERS)
  })
})

describe('FilterToolbar', () => {
  const nav = () => screen.getByRole('navigation', { name: 'Browse fleet categories' })

  it('shows a chip per category with its count and marks the active one', () => {
    render(<FilterToolbar {...props} filters={{ ...EMPTY_FILTERS, categoryId: 'sedan' }} />)

    expect(within(nav()).getByRole('button', { name: 'All cars 6' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(nav()).getByRole('button', { name: 'Sedan 4' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('filters by category when a chip is tapped', async () => {
    const user = userEvent.setup()
    render(<FilterToolbar {...props} />)

    await user.click(within(nav()).getByRole('button', { name: 'SUV 2' }))
    expect(onFiltersChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, categoryId: 'suv' })
  })

  it('opens an accessible filter sheet with the remaining filters and the sort order', async () => {
    const user = userEvent.setup()
    render(<FilterToolbar {...props} />)

    const open = screen.getByRole('button', { name: 'Filter' })
    expect(open).toHaveAttribute('aria-expanded', 'false')
    await user.click(open)

    const sheet = within(screen.getByRole('dialog', { name: 'Filter fleet' }))
    expect(open).toHaveAttribute('aria-expanded', 'true')
    expect(sheet.queryByText('Category')).not.toBeInTheDocument() // the chips already cover it
    await user.click(sheet.getByRole('checkbox', { name: /Toyota/ }))
    expect(onFiltersChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, brands: ['Toyota'] })

    await user.selectOptions(sheet.getByRole('combobox', { name: 'Sort by' }), 'price_desc')
    expect(onSortChange).toHaveBeenCalledWith('price_desc')
  })

  it('badges the Filter button with the number of active filters, not counting the category', () => {
    render(<FilterToolbar {...props} filters={{ ...EMPTY_FILTERS, categoryId: 'sedan', brands: ['Audi', 'Toyota'], minSeats: 5 }} />)
    expect(screen.getByRole('button', { name: /^Filter/ })).toHaveTextContent('3')
  })

  it('keeps the chosen category when the sheet clears the other filters', async () => {
    const user = userEvent.setup()
    render(<FilterToolbar {...props} filters={{ ...EMPTY_FILTERS, categoryId: 'sedan', brands: ['Audi'] }} />)

    await user.click(screen.getByRole('button', { name: /^Filter/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear filters' }))
    expect(onFiltersChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, categoryId: 'sedan' })
  })
})

describe('ResultsBar', () => {
  const barProps = { categories: options.categories, currency: 'AED', onFiltersChange }

  it('renders nothing while no filter is active, so the cars start level with the rail', () => {
    const { container } = render(<ResultsBar {...barProps} filters={EMPTY_FILTERS} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows each active filter as a chip that removes only itself', async () => {
    const user = userEvent.setup()
    const filters: VehicleFilters = { ...EMPTY_FILTERS, brands: ['Audi', 'Toyota'], transmission: 'manual', minSeats: 5, priceMin: 200, priceMax: 500 }
    render(<ResultsBar {...barProps} filters={filters} />)

    expect(screen.getByRole('button', { name: 'Remove 5+ seats' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove AED 200 – AED 500' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove Audi' }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...filters, brands: ['Toyota'] })

    await user.click(screen.getByRole('button', { name: 'Remove Manual' }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...filters, transmission: null })

    await user.click(screen.getByRole('button', { name: 'Remove AED 200 – AED 500' }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...filters, priceMin: null, priceMax: null })
  })

  it('words a one-sided price range as "From" or "Up to"', () => {
    const { rerender } = render(<ResultsBar {...barProps} filters={{ ...EMPTY_FILTERS, priceMin: 300 }} />)
    expect(screen.getByRole('button', { name: 'Remove From AED 300' })).toBeInTheDocument()

    rerender(<ResultsBar {...barProps} filters={{ ...EMPTY_FILTERS, priceMax: 800 }} />)
    expect(screen.getByRole('button', { name: 'Remove Up to AED 800' })).toBeInTheDocument()
  })

  it('offers a clear-all once more than one filter is active', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ResultsBar {...barProps} filters={{ ...EMPTY_FILTERS, brands: ['Audi'] }} />)
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()

    rerender(<ResultsBar {...barProps} filters={{ ...EMPTY_FILTERS, brands: ['Audi'], minSeats: 5 }} />)
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onFiltersChange).toHaveBeenCalledWith(EMPTY_FILTERS)
  })

})

describe('SortField', () => {
  it('changes the sort order', async () => {
    const user = userEvent.setup()
    render(<SortField sort="price_asc" onChange={onSortChange} />)

    const select = screen.getByRole('combobox', { name: 'Sort by' })
    expect(select).toHaveValue('price_asc')
    await user.selectOptions(select, 'price_desc')
    expect(onSortChange).toHaveBeenCalledWith('price_desc')
  })

  it('is inert while there is nothing to sort', () => {
    render(<SortField sort="price_asc" onChange={onSortChange} disabled />)
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeDisabled()
  })
})
