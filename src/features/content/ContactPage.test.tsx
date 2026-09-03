import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'

const functionsInvokeMock = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => functionsInvokeMock(...args) },
  },
}))

const { ContactPage } = await import('./ContactPage')

/**
 * Phase 9H — ContactPage.tsx's form previously had no backend at all (a
 * client-side setTimeout stub). These tests cover the real wiring to the
 * submit-complaint Edge Function; client-side validation itself was
 * already correct and unchanged, so it's covered here only incidentally.
 */
describe('ContactPage', () => {
  beforeEach(() => {
    functionsInvokeMock.mockReset()
    functionsInvokeMock.mockResolvedValue({ data: { complaintId: 'c1', status: 'open' }, error: null })
  })

  async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/your name/i), 'Jane Renter')
    await user.type(screen.getByLabelText(/your email/i), 'jane@example.com')
    await user.type(screen.getByLabelText(/message/i), 'My refund has not arrived yet.')
  }

  it('submits the form to the submit-complaint Edge Function with the entered fields', async () => {
    const user = userEvent.setup()
    render(<ContactPage />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(functionsInvokeMock).toHaveBeenCalledWith('submit-complaint', {
      body: { fullName: 'Jane Renter', email: 'jane@example.com', subject: '', message: 'My refund has not arrived yet.' },
    })
  })

  it('shows the success message and clears the form after a successful submission', async () => {
    const user = userEvent.setup()
    render(<ContactPage />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(await screen.findByText(/we've received your message/i)).toBeInTheDocument()
    expect((screen.getByLabelText(/your name/i) as HTMLInputElement).value).toBe('')
  })

  it('does not call the Edge Function when client-side validation fails', async () => {
    const user = userEvent.setup()
    render(<ContactPage />)
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(functionsInvokeMock).not.toHaveBeenCalled()
    expect(await screen.findByText(/please enter your name/i)).toBeInTheDocument()
  })

  it('shows an inline error and does not falsely report success when the Edge Function returns an error', async () => {
    functionsInvokeMock.mockResolvedValue({ data: null, error: { message: 'function unavailable' } })
    const user = userEvent.setup()
    render(<ContactPage />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(await screen.findByText(/we could not send your message/i)).toBeInTheDocument()
    expect(screen.queryByText(/we've received your message/i)).not.toBeInTheDocument()
  })

  it('shows an inline error when invoking the Edge Function itself rejects (network failure)', async () => {
    functionsInvokeMock.mockRejectedValue(new Error('network error'))
    const user = userEvent.setup()
    render(<ContactPage />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(await screen.findByText(/we could not send your message/i)).toBeInTheDocument()
  })
})
