import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StateMessage } from './StateMessage'
import { LoadingState } from './ui/LoadingState'

describe('StateMessage', () => {
  it('defaults to the neutral tone', () => {
    render(<StateMessage title="No results" body="Try a different search." />)
    expect(screen.getByRole('heading', { name: 'No results' })).toBeInTheDocument()
    expect(screen.getByText('Try a different search.')).toBeInTheDocument()
  })

  it('renders the error tone', () => {
    render(<StateMessage title="Something went wrong" tone="error" />)
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
  })

  it('renders the new Phase 8 success tone additively (existing tones untouched)', () => {
    render(<StateMessage title="Request submitted" tone="success" />)
    expect(screen.getByRole('heading', { name: 'Request submitted' })).toBeInTheDocument()
  })

  it('renders the provided action', () => {
    render(<StateMessage title="Empty" action={<button type="button">Retry</button>} />)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})

describe('LoadingState', () => {
  it('renders a caption alongside the shared spinner', () => {
    render(<LoadingState label="Loading vehicles…" />)
    expect(screen.getByText('Loading vehicles…')).toBeInTheDocument()
  })
})
