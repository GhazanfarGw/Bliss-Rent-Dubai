import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable, type DataTableColumn } from './DataTable'

interface Row {
  id: string
  name: string
  amount: number
}

const rows: Row[] = [
  { id: 'r1', name: 'Ahmed', amount: 500 },
  { id: 'r2', name: 'Sara', amount: 750 },
]

const columns: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Customer', render: (r) => r.name },
  { key: 'amount', header: 'Amount', render: (r) => `AED ${r.amount}` },
]

describe('DataTable — reflow variant (default)', () => {
  it('renders both a table (desktop) and a stacked card list (mobile) from the same rows', () => {
    render(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />)
    // Table view
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByText('Ahmed')).toHaveLength(2) // once in <table>, once in the card list
  })

  it('calls onRowClick with the right row when a table row is clicked', () => {
    const onRowClick = vi.fn()
    render(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} onRowClick={onRowClick} />)
    const cell = screen.getAllByText('Sara')[0]
    fireEvent.click(cell.closest('tr')!)
    expect(onRowClick).toHaveBeenCalledWith(rows[1])
  })

  it('renders the given empty state and no table when there are no rows', () => {
    render(<DataTable columns={columns} rows={[]} getRowKey={(r) => r.id} emptyState={<p>No results</p>} />)
    expect(screen.getByText('No results')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('DataTable — scroll variant', () => {
  it('renders only the table, never a card list, for genuinely dense tables', () => {
    const { container } = render(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} variant="scroll" />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(container.querySelectorAll('ul').length).toBe(0)
    // First column is pinned for horizontal scrolling.
    const firstHeaderCell = screen.getByRole('columnheader', { name: 'Customer' })
    expect(firstHeaderCell.className).toMatch(/sticky/)
  })
})
