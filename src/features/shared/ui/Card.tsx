import type { HTMLAttributes, ReactNode } from 'react'

interface CardSlotProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/**
 * The one shared card surface — rounded-2xl + border + shadow-sm + p-6,
 * generalizing the "elevated panel" pattern already used (with drifting
 * radius/padding) across booking-search, checkout, and admin detail
 * pages. `CardHeader`/`CardSection` generalize the header + stacked-
 * section shape already proven on Bookings/Customers/Complaints detail
 * pages, so new pages reach for these instead of a bespoke div.
 *
 * (Exported as three plain named components, not a `Card.Header`
 * compound-component object — that pattern trips up this project's
 * react-refresh lint rule, which expects a file to export components
 * directly.)
 */
export function Card({ children, className = '', ...rest }: CardSlotProps) {
  return (
    <div className={'border border-border bg-surface p-6 shadow-sm ' + className} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '', ...rest }: CardSlotProps) {
  return (
    <div className={'mb-4 flex flex-wrap items-start justify-between gap-3 ' + className} {...rest}>
      {children}
    </div>
  )
}

export function CardSection({ children, className = '', ...rest }: CardSlotProps) {
  return (
    <div className={'border-t border-border pt-4 first:border-t-0 first:pt-0 ' + className} {...rest}>
      {children}
    </div>
  )
}
