import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { storeSupportChatSession } from '@/lib/supportChatStorage'
import { SupportChatApiError } from '@/features/shared/supportChatApi'

const startSupportChatMock = vi.fn()
const sendSupportChatMessageMock = vi.fn()
const fetchSupportChatThreadMock = vi.fn()

vi.mock('@/features/shared/supportChatApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/shared/supportChatApi')>('@/features/shared/supportChatApi')
  return {
    ...actual,
    startSupportChat: (...args: unknown[]) => startSupportChatMock(...args),
    sendSupportChatMessage: (...args: unknown[]) => sendSupportChatMessageMock(...args),
    fetchSupportChatThread: (...args: unknown[]) => fetchSupportChatThreadMock(...args),
  }
})

const { SupportChatWidget } = await import('./SupportChatWidget')

function renderWidget() {
  return render(
    <MemoryRouter>
      <SupportChatWidget />
    </MemoryRouter>,
  )
}

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /support chat/i }))
  return screen.findByRole('dialog')
}

beforeEach(() => {
  // The widget's initial mode (FAQ vs. live chat) depends on whether a
  // Support Chat session is already in localStorage — clear it so every
  // test starts as a fresh visitor unless it seeds one deliberately.
  localStorage.clear()
  startSupportChatMock.mockReset()
  sendSupportChatMessageMock.mockReset()
  fetchSupportChatThreadMock.mockReset()
  fetchSupportChatThreadMock.mockResolvedValue({ complaintId: 'c1', status: 'open', messages: [] })
})

describe('SupportChatWidget', () => {
  it('is not visible until the sticky tab is clicked', () => {
    renderWidget()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens with a greeting and a topic chip per real FAQ category', async () => {
    const user = userEvent.setup()
    renderWidget()
    await openPanel(user)

    expect(screen.getByText(/quick questions about booking/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Booking & payment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eligibility & documents' })).toBeInTheDocument()
  })

  it('walks topic → question → the real FAQ answer, as chat bubbles', async () => {
    const user = userEvent.setup()
    renderWidget()
    await openPanel(user)

    await user.click(screen.getByRole('button', { name: 'Booking & payment' }))
    expect(screen.getByText(/here are our top questions on booking & payment/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'How do I pay for my booking?' }))
    expect(
      screen.getByText('Payment is completed securely online as the last step of checkout, for the full amount shown in your booking summary.'),
    ).toBeInTheDocument()
  })

  it('"Back" returns from a category to the topic chips', async () => {
    const user = userEvent.setup()
    renderWidget()
    await openPanel(user)

    await user.click(screen.getByRole('button', { name: 'Booking & payment' }))
    await user.click(screen.getByRole('button', { name: /back/i }))

    expect(screen.getByRole('button', { name: 'Eligibility & documents' })).toBeInTheDocument()
  })

  it('typing a question searches the same real FAQ content and surfaces a matching chip', async () => {
    const user = userEvent.setup()
    renderWidget()
    await openPanel(user)

    await user.type(screen.getByLabelText(/your question/i), 'mileage')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('button', { name: 'Is there a mileage limit or fuel policy?' })).toBeInTheDocument()
  })

  it('falls back to a "could not find" message and keeps real contact links when nothing matches', async () => {
    const user = userEvent.setup()
    renderWidget()
    await openPanel(user)

    await user.type(screen.getByLabelText(/your question/i), 'zzzznonexistentzzzz')
    await user.keyboard('{Enter}')

    expect(await screen.findByText(/couldn't find an exact answer/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute('href', expect.stringContaining('wa.me'))
    expect(screen.getByRole('link', { name: /email/i })).toHaveAttribute('href', expect.stringContaining('mailto:'))
    expect(screen.getByRole('link', { name: /browse all faqs/i })).toHaveAttribute('href', '/faqs')
  })
})

describe('SupportChatWidget — message our team (live chat)', () => {
  it('shows the start form for a new visitor, without calling the API yet', async () => {
    const user = userEvent.setup()
    renderWidget()
    await openPanel(user)
    await user.click(screen.getByRole('button', { name: /message our team/i }))

    expect(screen.getByLabelText('Your name')).toBeInTheDocument()
    expect(startSupportChatMock).not.toHaveBeenCalled()
  })

  it('validates the start form before ever calling the API', async () => {
    const user = userEvent.setup()
    renderWidget()
    await openPanel(user)
    await user.click(screen.getByRole('button', { name: /message our team/i }))
    await user.click(screen.getByRole('button', { name: 'Start chat' }))

    expect(await screen.findByText('Please enter your name.')).toBeInTheDocument()
    expect(startSupportChatMock).not.toHaveBeenCalled()
  })

  it('starts a conversation and shows it as a live thread', async () => {
    startSupportChatMock.mockResolvedValue({ complaintId: 'c1', accessToken: 'tok-1', status: 'open' })
    fetchSupportChatThreadMock.mockResolvedValue({
      complaintId: 'c1',
      status: 'open',
      messages: [{ id: 'm1', sender: 'customer', body: 'My key was locked in the car', imageUrl: null, createdAt: '2026-09-13T10:00:00Z' }],
    })
    const user = userEvent.setup()
    renderWidget()
    await openPanel(user)
    await user.click(screen.getByRole('button', { name: /message our team/i }))

    await user.type(screen.getByLabelText('Your name'), 'Jane Renter')
    await user.type(screen.getByLabelText('Your email'), 'jane@example.com')
    await user.type(screen.getByLabelText('How can we help?'), 'My key was locked in the car')
    await user.click(screen.getByRole('button', { name: 'Start chat' }))

    expect(startSupportChatMock).toHaveBeenCalledWith({
      fullName: 'Jane Renter',
      email: 'jane@example.com',
      message: 'My key was locked in the car',
      image: undefined,
    })
    expect(await screen.findByText('My key was locked in the car')).toBeInTheDocument()
  })

  it('shows a field error returned by the server instead of a generic one', async () => {
    startSupportChatMock.mockRejectedValue(
      new SupportChatApiError({
        code: 'VALIDATION_ERROR',
        message: 'Please check the highlighted fields.',
        fieldErrors: { email: 'Please enter a valid email address.' },
      }),
    )
    const user = userEvent.setup()
    renderWidget()
    await openPanel(user)
    await user.click(screen.getByRole('button', { name: /message our team/i }))

    await user.type(screen.getByLabelText('Your name'), 'Jane Renter')
    await user.type(screen.getByLabelText('Your email'), 'not-an-email')
    await user.type(screen.getByLabelText('How can we help?'), 'Question')
    await user.click(screen.getByRole('button', { name: 'Start chat' }))

    expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument()
  })

  it('resumes an existing conversation for a returning visitor instead of showing the start form', async () => {
    storeSupportChatSession({ accessToken: 'tok-existing', complaintId: 'c9', name: 'Jane Renter', email: 'jane@example.com' })
    fetchSupportChatThreadMock.mockResolvedValue({
      complaintId: 'c9',
      status: 'open',
      messages: [{ id: 'm1', sender: 'admin', body: 'Thanks for reaching out — looking into it now.', imageUrl: null, createdAt: '2026-09-13T10:00:00Z' }],
    })
    const user = userEvent.setup()
    renderWidget()
    await openPanel(user)

    expect(await screen.findByText('Thanks for reaching out — looking into it now.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument()
  })

  it('sends a follow-up message on an existing conversation', async () => {
    storeSupportChatSession({ accessToken: 'tok-existing', complaintId: 'c9', name: 'Jane Renter', email: 'jane@example.com' })
    fetchSupportChatThreadMock.mockResolvedValue({ complaintId: 'c9', status: 'open', messages: [] })
    sendSupportChatMessageMock.mockResolvedValue({ messageId: 'm2', createdAt: '2026-09-13T10:10:00Z' })
    const user = userEvent.setup()
    renderWidget()
    await openPanel(user)

    await screen.findByPlaceholderText('Type a message…')
    await user.type(screen.getByPlaceholderText('Type a message…'), 'Any update?')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(sendSupportChatMessageMock).toHaveBeenCalledWith({ accessToken: 'tok-existing', message: 'Any update?', image: undefined })
  })
})
