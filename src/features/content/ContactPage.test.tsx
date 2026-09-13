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

const { ContactPage } = await import('./ContactPage')

// ContactPage renders real <Link>s (e.g. the closing CTA), which need a
// Router context to exist at all — same MemoryRouter-wrapping convention
// as VehicleCard.test.tsx/Hero.test.tsx.
function renderContactPage() {
  return render(
    <MemoryRouter>
      <ContactPage />
    </MemoryRouter>,
  )
}

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
    renderContactPage()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(functionsInvokeMock).toHaveBeenCalledWith('submit-complaint', {
      body: { fullName: 'Jane Renter', email: 'jane@example.com', subject: '', message: 'My refund has not arrived yet.' },
    })
  })

  it('shows the success message and clears the form after a successful submission', async () => {
    const user = userEvent.setup()
    renderContactPage()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(await screen.findByText(/we've received your message/i)).toBeInTheDocument()
    expect((screen.getByLabelText(/your name/i) as HTMLInputElement).value).toBe('')
  })

  it('does not call the Edge Function when client-side validation fails', async () => {
    const user = userEvent.setup()
    renderContactPage()
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(functionsInvokeMock).not.toHaveBeenCalled()
    expect(await screen.findByText(/please enter your name/i)).toBeInTheDocument()
  })

  it('shows an inline error and does not falsely report success when the Edge Function returns an error', async () => {
    functionsInvokeMock.mockResolvedValue({ data: null, error: { message: 'function unavailable' } })
    const user = userEvent.setup()
    renderContactPage()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(await screen.findByText(/we could not send your message/i)).toBeInTheDocument()
    expect(screen.queryByText(/we've received your message/i)).not.toBeInTheDocument()
  })

  it('shows an inline error when invoking the Edge Function itself rejects (network failure)', async () => {
    functionsInvokeMock.mockRejectedValue(new Error('network error'))
    const user = userEvent.setup()
    renderContactPage()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /send message/i }))

    expect(await screen.findByText(/we could not send your message/i)).toBeInTheDocument()
  })

  it('shows a real tel: link for calling, using the same number as WhatsApp', () => {
    renderContactPage()
    const callLink = screen.getByRole('link', { name: /call us/i })
    expect(callLink).toHaveAttribute('href', 'tel:+971547820057')
  })

  it('shows the real 24/7 support hours instead of the old bracketed placeholder', () => {
    renderContactPage()
    expect(screen.getByText('24/7')).toBeInTheDocument()
    expect(screen.queryByText(/\[e\.g\. 24\/7/i)).not.toBeInTheDocument()
  })

  it('renders the FAQ shortcut questions collapsed, expanding an answer on click', async () => {
    const user = userEvent.setup()
    renderContactPage()
    const question = screen.getByRole('button', { name: /can i cancel or change my booking/i })
    expect(screen.queryByText(/booking terms & conditions/i)).not.toBeInTheDocument()

    await user.click(question)
    expect(screen.getByText(/booking terms & conditions/i)).toBeInTheDocument()
    expect(question).toHaveAttribute('aria-expanded', 'true')
  })

  it('links the FAQ shortcut through to the full FAQ page', () => {
    renderContactPage()
    expect(screen.getByRole('link', { name: /view all faqs/i })).toHaveAttribute('href', '/faqs')
  })
})
