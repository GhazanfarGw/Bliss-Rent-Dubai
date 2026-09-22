import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ManageBookingLookupCard } from '@/features/booking/ManageBookingLookupCard'

function renderCard(overrides: Partial<Parameters<typeof ManageBookingLookupCard>[0]> = {}) {
  const onQueryChange = vi.fn()
  const onLastNameChange = vi.fn()
  const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
  const { container } = render(
    <ManageBookingLookupCard
      query=""
      onQueryChange={onQueryChange}
      lastName=""
      onLastNameChange={onLastNameChange}
      onSubmit={onSubmit}
      loading={false}
      notFound={false}
      errorMessage={null}
      {...overrides}
    />,
  )
  return { onQueryChange, onLastNameChange, onSubmit, container }
}

describe('ManageBookingLookupCard', () => {
  it('renders no card chrome of its own — the outermost element is the bare form', () => {
    const { container } = renderCard()
    // ManageBookingHero supplies the bordered/shadowed card wrapper; this component stays a bare <form>.
    expect(container.firstElementChild?.tagName).toBe('FORM')
  })

  it('reports field changes and submits via the provided callbacks — no logic of its own', () => {
    const { onQueryChange, onLastNameChange, onSubmit } = renderCard()

    fireEvent.change(screen.getByPlaceholderText('Booking Reference or Vehicle Plate Number'), { target: { value: 'BLS-ABCDEF12' } })
    expect(onQueryChange).toHaveBeenCalledWith('BLS-ABCDEF12')

    fireEvent.change(screen.getByPlaceholderText('Last Name'), { target: { value: 'Renter' } })
    expect(onLastNameChange).toHaveBeenCalledWith('Renter')

    fireEvent.click(screen.getByRole('button', { name: /find my booking/i }))
    expect(onSubmit).toHaveBeenCalled()
  })

  it('gives the help icon an accessible name, since it carries no visible text', () => {
    renderCard()
    expect(screen.getByRole('button', { name: /what's a booking reference/i })).toBeInTheDocument()
  })

  it('links to a real WhatsApp chat, not an invented account-login flow', () => {
    renderCard()
    const link = screen.getByRole('link', { name: /whatsapp/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('wa.me'))
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
