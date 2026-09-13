import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ComplaintDetailPage } from './ComplaintDetailPage'
import type { AdminComplaintWithDetails } from '@/types/domain'

const fetchComplaintByIdMock = vi.fn()
const updateComplaintMock = vi.fn()
const sendComplaintReplyMock = vi.fn()
const fetchComplaintThreadMock = vi.fn()
const sendComplaintChatMessageMock = vi.fn()
const getComplaintAttachmentUrlMock = vi.fn()

vi.mock('./adminComplaintsApi', async () => {
  const actual = await vi.importActual<typeof import('./adminComplaintsApi')>('./adminComplaintsApi')
  return {
    ...actual,
    fetchComplaintById: (...args: unknown[]) => fetchComplaintByIdMock(...args),
    updateComplaint: (...args: unknown[]) => updateComplaintMock(...args),
    sendComplaintReply: (...args: unknown[]) => sendComplaintReplyMock(...args),
    fetchComplaintThread: (...args: unknown[]) => fetchComplaintThreadMock(...args),
    sendComplaintChatMessage: (...args: unknown[]) => sendComplaintChatMessageMock(...args),
    getComplaintAttachmentUrl: (...args: unknown[]) => getComplaintAttachmentUrlMock(...args),
  }
})

const baseComplaint: AdminComplaintWithDetails = {
  id: 'c1',
  booking_id: null,
  customer_id: 'cust-1',
  subject: 'Late delivery',
  description: 'My car was delivered 2 hours late.',
  status: 'open',
  created_at: '2026-09-10T12:00:00Z',
  resolved_at: null,
  internal_notes: null,
  resolution: null,
  admin_reply_message: null,
  admin_reply_sent_at: null,
  access_token: 'access-token-1',
  customers: { id: 'cust-1', full_name: 'Jane Renter', email: 'jane@example.com', phone: null, auth_user_id: null, created_at: '2026-01-01T00:00:00Z' } as unknown as AdminComplaintWithDetails['customers'],
  bookings: null,
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/complaints/c1']}>
      <Routes>
        <Route path="/admin/complaints/:id" element={<ComplaintDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ComplaintDetailPage — reply to customer', () => {
  beforeEach(() => {
    fetchComplaintByIdMock.mockReset()
    updateComplaintMock.mockReset()
    sendComplaintReplyMock.mockReset()
    fetchComplaintThreadMock.mockReset()
    sendComplaintChatMessageMock.mockReset()
    getComplaintAttachmentUrlMock.mockReset()
    fetchComplaintByIdMock.mockResolvedValue(baseComplaint)
    fetchComplaintThreadMock.mockResolvedValue([])
  })

  it('sends a reply and shows confirmation once the email is triggered', async () => {
    sendComplaintReplyMock.mockResolvedValue({ emailTriggered: true })
    renderPage()

    await screen.findByText('Late delivery')
    const textarea = screen.getByPlaceholderText('Type the reply that will be emailed to the customer…')
    fireEvent.change(textarea, { target: { value: 'Sorry about that, refund issued.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))

    await waitFor(() => expect(sendComplaintReplyMock).toHaveBeenCalledWith('c1', 'Sorry about that, refund issued.'))
    expect(await screen.findByText('Reply sent to the customer’s email.')).toBeInTheDocument()
  })

  it('shows a distinct banner when the reply saved but the email trigger failed', async () => {
    sendComplaintReplyMock.mockResolvedValue({ emailTriggered: false })
    renderPage()

    await screen.findByText('Late delivery')
    fireEvent.change(screen.getByPlaceholderText('Type the reply that will be emailed to the customer…'), { target: { value: 'Reply text' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(await screen.findByText(/Reply saved, but sending the email failed/)).toBeInTheDocument()
  })

  it('rejects sending an empty reply without calling the API', async () => {
    renderPage()

    await screen.findByText('Late delivery')
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(await screen.findByText('Please enter a reply before sending.')).toBeInTheDocument()
    expect(sendComplaintReplyMock).not.toHaveBeenCalled()
  })

  it('pre-fills and shows the last-sent time for a complaint that already has a reply', async () => {
    fetchComplaintByIdMock.mockResolvedValue({
      ...baseComplaint,
      admin_reply_message: 'Previously sent reply.',
      admin_reply_sent_at: '2026-09-10T15:00:00Z',
    })
    renderPage()

    await screen.findByText('Late delivery')
    expect(screen.getByDisplayValue('Previously sent reply.')).toBeInTheDocument()
    expect(screen.getByText(/Last sent/)).toBeInTheDocument()
  })
})

describe('ComplaintDetailPage — live chat', () => {
  beforeEach(() => {
    fetchComplaintByIdMock.mockReset()
    updateComplaintMock.mockReset()
    sendComplaintReplyMock.mockReset()
    fetchComplaintThreadMock.mockReset()
    sendComplaintChatMessageMock.mockReset()
    getComplaintAttachmentUrlMock.mockReset()
    fetchComplaintByIdMock.mockResolvedValue(baseComplaint)
  })

  it('synthesizes the original description as the opening bubble when there is no real thread yet', async () => {
    fetchComplaintThreadMock.mockResolvedValue([])
    renderPage()

    await screen.findByText('Late delivery')
    // Appears twice once loaded: once in the read-only "Complaint details"
    // section (always shown), and once as the synthesized opening chat
    // bubble (only shown because the real thread came back empty).
    await waitFor(() => expect(screen.getAllByText('My car was delivered 2 hours late.')).toHaveLength(2))
  })

  it('renders real thread messages from both the customer and the admin', async () => {
    fetchComplaintThreadMock.mockResolvedValue([
      { id: 'm1', complaint_id: 'c1', sender: 'customer', body: 'Any update?', image_path: null, created_at: '2026-09-10T13:00:00Z' },
      { id: 'm2', complaint_id: 'c1', sender: 'admin', body: 'Looking into it now.', image_path: null, created_at: '2026-09-10T13:05:00Z' },
    ])
    renderPage()

    await screen.findByText('Late delivery')
    expect(await screen.findByText('Any update?')).toBeInTheDocument()
    expect(screen.getByText('Looking into it now.')).toBeInTheDocument()
  })

  it('sends a chat reply and reloads the thread', async () => {
    fetchComplaintThreadMock.mockResolvedValue([])
    sendComplaintChatMessageMock.mockResolvedValue(undefined)
    renderPage()

    await screen.findByText('Late delivery')
    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'We are on it!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(sendComplaintChatMessageMock).toHaveBeenCalledWith('c1', 'We are on it!'))
    expect(fetchComplaintThreadMock).toHaveBeenCalledTimes(2)
  })

  it('shows an error and keeps the draft when sending a chat reply fails', async () => {
    fetchComplaintThreadMock.mockResolvedValue([])
    sendComplaintChatMessageMock.mockRejectedValue(new Error('permission denied'))
    renderPage()

    await screen.findByText('Late delivery')
    fireEvent.change(screen.getByPlaceholderText('Type a message…'), { target: { value: 'We are on it!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('permission denied')).toBeInTheDocument()
    expect(screen.getByDisplayValue('We are on it!')).toBeInTheDocument()
  })
})
