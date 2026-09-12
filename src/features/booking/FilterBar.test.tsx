import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterBar } from '@/features/booking/FilterBar'
import { EMPTY_FILTERS } from '@/types/domain'

const props = {
  categories: [{ id: 'sedan', name: 'Sedan' }],
  brands: ['Toyota'],
  transmissions: ['automatic'],
  filters: EMPTY_FILTERS,
  sort: 'price_asc' as const,
  resultCount: 1,
  onFiltersChange: vi.fn(),
  onSortChange: vi.fn(),
  showAvailabilityFilter: true,
}

describe('FilterBar', () => {
  it('opens an accessible mobile filter sheet and applies draft filters', async () => {
    const user = userEvent.setup()
    render(<FilterBar {...props} />)

    const openButton = screen.getByRole('button', { name: 'Filter' })
    expect(openButton).toHaveAttribute('aria-expanded', 'false')
    await user.click(openButton)

    const dialog = screen.getByRole('dialog', { name: 'Filter fleet' })
    expect(openButton).toHaveAttribute('aria-expanded', 'true')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Brand' }), 'Toyota')

    expect(props.onFiltersChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, brand: 'Toyota' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('clears active filters through the desktop control', async () => {
    const user = userEvent.setup()
    const onFiltersChange = vi.fn()
    render(<FilterBar {...props} filters={{ ...EMPTY_FILTERS, brand: 'Toyota' }} onFiltersChange={onFiltersChange} />)

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    expect(onFiltersChange).toHaveBeenCalledWith(EMPTY_FILTERS)
  })
})
