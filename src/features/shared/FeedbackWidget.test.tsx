import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import '@/i18n'

const functionsInvokeMock = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => functionsInvokeMock(...args) },
  },
}))

const { FeedbackWidget } = await import('./FeedbackWidget')

function renderWidget(initialPath = '/about') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <FeedbackWidget />
    </MemoryRouter>,
  )
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /feedback/i }))
  return screen.findByRole('dialog')
}

describe('FeedbackWidget', () => {
  beforeEach(() => {
    functionsInvokeMock.mockReset()
    functionsInvokeMock.mockResolvedValue({ data: { feedbackId: 'f1' }, error: null })
  })

  it('is not visible until the sticky tab is clicked', () => {
    renderWidget()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the feedback form when the sticky tab is clicked', async () => {
    const user = userEvent.setup()
    renderWidget()
    await openDialog(user)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })

  it('does not submit without a star rating chosen', async () => {
    const user = userEvent.setup()
    renderWidget()
    await openDialog(user)

    await user.click(screen.getByRole('button', { name: /send feedback/i }))

    expect(functionsInvokeMock).not.toHaveBeenCalled()
    expect(await screen.findByText(/choose a star rating/i)).toBeInTheDocument()
  })

  it('submits the chosen rating, message, page path, and locale to the submit-feedback Edge Function', async () => {
    const user = userEvent.setup()
    renderWidget('/about')
    await openDialog(user)

    await user.click(screen.getByRole('radio', { name: /^Rate 4 /i }))
    await user.type(screen.getByLabelText(/message/i), 'Loved the service!')
    await user.click(screen.getByRole('button', { name: /send feedback/i }))

    expect(functionsInvokeMock).toHaveBeenCalledWith('submit-feedback', {
      body: { rating: 4, message: 'Loved the service!', pagePath: '/about', locale: 'en' },
    })
  })

  it('shows a thank-you message after a successful submission', async () => {
    const user = userEvent.setup()
    renderWidget()
    await openDialog(user)

    await user.click(screen.getByRole('radio', { name: /^Rate 5 /i }))
    await user.click(screen.getByRole('button', { name: /send feedback/i }))

    expect(await screen.findByText(/thank you/i)).toBeInTheDocument()
  })

  it('shows an inline error and does not falsely report success when the Edge Function returns an error', async () => {
    functionsInvokeMock.mockResolvedValue({ data: null, error: { message: 'function unavailable' } })
    const user = userEvent.setup()
    renderWidget()
    await openDialog(user)

    await user.click(screen.getByRole('radio', { name: /^Rate 3 /i }))
    await user.click(screen.getByRole('button', { name: /send feedback/i }))

    expect(await screen.findByText(/could not send your feedback/i)).toBeInTheDocument()
    expect(screen.queryByText(/thank you/i)).not.toBeInTheDocument()
  })
})
