import type { ReactNode } from 'react'
import { DetailRow } from './DetailRow'

export interface DataTableColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Included in the stacked mobile-card view (the 'reflow' variant).
   *  Defaults to true — set false for a column that only makes sense in
   *  the full table (e.g. a redundant id column). */
  showInCard?: boolean
  /** Extra classes for this column's `<th>`/`<td>` (e.g. a fixed width). */
  className?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  /**
   * 'reflow' (default): a real `<table>` at `md`+ and a stacked-card
   * list below `md` — for the typical admin list (Customers, Payments,
   * Staff, Audit Log) where reflowing to cards keeps every field
   * legible on a phone instead of forcing horizontal scroll.
   *
   * 'scroll': always a real table, horizontally scrollable, with the
   * first column pinned via `sticky start-0` — for genuinely dense
   * tables (Extensions' 10 columns, Bookings' two-status-badge rows)
   * where reflowing to cards would lose too much side-by-side
   * comparability. This is a deliberate per-table choice, not the
   * default every table used before Phase 8 (see the audit, section 8).
   */
  variant?: 'reflow' | 'scroll'
  minWidthClassName?: string
  onRowClick?: (row: T) => void
  emptyState?: ReactNode
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  variant = 'reflow',
  minWidthClassName = 'min-w-[720px]',
  onRowClick,
  emptyState,
}: DataTableProps<T>) {
  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  const table = (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className={`w-full divide-y divide-border text-sm ${minWidthClassName}`}>
        <thead className="bg-surface-muted">
          <tr>
            {columns.map((col, i) => (
              <th
                key={col.key}
                scope="col"
                className={
                  'px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-text-muted ' +
                  (variant === 'scroll' && i === 0 ? 'sticky start-0 z-10 bg-surface-muted ' : '') +
                  (col.className ?? '')
                }
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-info-bg/40' : undefined}
            >
              {columns.map((col, i) => (
                <td
                  key={col.key}
                  className={
                    'px-4 py-3 align-top ' +
                    (variant === 'scroll' && i === 0 ? 'sticky start-0 z-10 bg-surface ' : '') +
                    (col.className ?? '')
                  }
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  if (variant === 'scroll') {
    return table
  }

  // 'reflow': both the table and the card list render always — CSS
  // breakpoints (hidden/md:hidden) decide which is visible, the same
  // convention AdminLayout already uses for its desktop sidebar vs.
  // mobile drawer — so there's no JS breakpoint logic to get out of
  // sync with the CSS, and it stays testable in jsdom.
  return (
    <>
      <div className="hidden md:block">{table}</div>
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li
            key={getRowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={'rounded-2xl border border-border bg-surface p-4 shadow-sm ' + (onRowClick ? 'cursor-pointer' : '')}
          >
            {columns
              .filter((col) => col.showInCard !== false)
              .map((col) => (
                <DetailRow key={col.key} label={col.header} value={col.render(row)} />
              ))}
          </li>
        ))}
      </ul>
    </>
  )
}
