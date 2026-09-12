import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ManageBookingLookupCard } from '@/features/booking/ManageBookingLookupCard'

function renderCard(overrides: Partial<Parameters<typeof ManageBookingLookupCard>[0]> = {}) {
  const onQueryChange = vi.fn()
  const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
  render(
    <ManageBookingLookupCard
      query=""
      onQueryChange={onQueryChange}
      onSubmit={onSubmit}
      loading={false}
      notFound={false}
      errorMessage={null}
      {...overrides}
    />,
  )
  return { onQueryChange, onSubmit }
}

describe('ManageBookingLookupCard', () => {
  it('renders the numbered steps explaining the flow', () => {
    renderCard()
    expect(screen.getByText('Enter your details')).toBeInTheDocument()
    expect(screen.getByText('Review your booking')).toBeInTheDocument()
    expect(screen.getByText('Extend or pay')).toBeInTheDocument()
  })

  it('reports field changes and submits via the provided callbacks — no logic of its own', () => {
    const { onQueryChange, onSubmit } = renderCard()

    fireEvent.change(screen.getByPlaceholderText('BLS-XXXXXXXX or ABC-123'), { target: { value: 'BLS-ABCDEF12' } })
    expect(onQueryChange).toHaveBeenCalledWith('BLS-ABCDEF12')

    fireEvent.click(screen.getByRole('button', { name: /find my car/i }))
    expect(onSubmit).toHaveBeenCalled()
  })

  it('shows the loading label and disables the button while loading', () => {
    renderCard({ loading: true })
    const button = screen.getByRole('button', { name: /checking/i })
    expect(button).toBeDisabled()
  })

  it('shows the not-found message only when notFound is true', () => {
    renderCard({ notFound: true })
    expect(screen.getByText(/couldn't find a booking/i)).toBeInTheDocument()
  })

  it('shows the given error message', () => {
    renderCard({ errorMessage: 'connection failed' })
    expect(screen.getByText('connection failed')).toBeInTheDocument()
  })

  it('shows neither message by default', () => {
    renderCard()
    expect(screen.queryByText(/couldn't find a booking/i)).not.toBeInTheDocument()
  })
})
