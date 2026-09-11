import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ComplaintDetailPage } from './ComplaintDetailPage'
import type { AdminComplaintWithDetails } from '@/types/domain'

const fetchComplaintByIdMock = vi.fn()
const updateComplaintMock = vi.fn()
const sendComplaintReplyMock = vi.fn()

vi.mock('./adminComplaintsApi', async () => {
  const actual = await vi.importActual<typeof import('./adminComplaintsApi')>('./adminComplaintsApi')
  return {
    ...actual,
    fetchComplaintById: (...args: unknown[]) => fetchComplaintByIdMock(...args),
    updateComplaint: (...args: unknown[]) => updateComplaintMock(...args),
    sendComplaintReply: (...args: unknown[]) => sendComplaintReplyMock(...args),
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
    fetchComplaintByIdMock.mockResolvedValue(baseComplaint)
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
