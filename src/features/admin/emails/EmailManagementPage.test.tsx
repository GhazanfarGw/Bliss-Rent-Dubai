import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { EmailManagementPage } from './EmailManagementPage'
import { AdminApiError } from '@/features/admin/adminApi'

const fetchEmailLogMock = vi.fn()
const fetchEmailLogEventTypesMock = vi.fn()
const fetchEmailPreviewCatalogMock = vi.fn()
const fetchEmailPreviewHtmlMock = vi.fn()
const sendTestEmailMock = vi.fn()

vi.mock('./adminEmailApi', async () => {
  const actual = await vi.importActual<typeof import('./adminEmailApi')>('./adminEmailApi')
  return {
    ...actual,
    fetchEmailLog: (...args: unknown[]) => fetchEmailLogMock(...args),
    fetchEmailLogEventTypes: (...args: unknown[]) => fetchEmailLogEventTypesMock(...args),
    fetchEmailPreviewCatalog: (...args: unknown[]) => fetchEmailPreviewCatalogMock(...args),
    fetchEmailPreviewHtml: (...args: unknown[]) => fetchEmailPreviewHtmlMock(...args),
    sendTestEmail: (...args: unknown[]) => sendTestEmailMock(...args),
  }
})

const LOG_ENTRY = {
  id: 'log-1',
  idempotency_key: 'booking:b1:booking_confirmed',
  booking_id: 'b1',
  event_type: 'booking_confirmed',
  recipient_type: 'customer',
  recipient_email: 'jane@example.com',
  language: 'en',
  template: 'customer_booking_confirmation',
  subject: 'Booking confirmed',
  status: 'sent',
  provider_message_id: 'msg-1',
  failure_reason: null,
  retry_count: 0,
  created_at: '2026-09-01T10:00:00.000Z',
  sent_at: '2026-09-01T10:00:01.000Z',
  updated_at: '2026-09-01T10:00:01.000Z',
}

const CATALOG = [
  { category: 'customer' as const, eventType: 'booking_confirmed', label: 'booking_confirmed' },
  { category: 'customer' as const, eventType: 'pickup_reminder', label: 'pickup_reminder' },
  { category: 'admin' as const, eventType: 'admin_booking_received', label: 'admin_booking_received' },
  { category: 'complaint' as const, eventType: 'admin_complaint_received', label: 'admin_complaint_received' },
]

describe('EmailManagementPage', () => {
  beforeEach(() => {
    fetchEmailLogMock.mockReset()
    fetchEmailLogEventTypesMock.mockReset()
    fetchEmailPreviewCatalogMock.mockReset()
    fetchEmailPreviewHtmlMock.mockReset()
    sendTestEmailMock.mockReset()

    fetchEmailLogMock.mockResolvedValue([LOG_ENTRY])
    fetchEmailLogEventTypesMock.mockResolvedValue(['booking_confirmed', 'admin_booking_received'])
    fetchEmailPreviewCatalogMock.mockResolvedValue(CATALOG)
  })

  it('defaults to the Delivery log tab and lists email_log rows', async () => {
    render(<EmailManagementPage />)
    expect(await screen.findByText('jane@example.com')).toBeInTheDocument()
    const row = screen.getByText('jane@example.com').closest('tr')!
    expect(within(row).getByText('booking_confirmed')).toBeInTheDocument()
    expect(within(row).getByText('Sent')).toBeInTheDocument()
  })

  it('shows the empty state when there are no matching log rows', async () => {
    fetchEmailLogMock.mockResolvedValue([])
    render(<EmailManagementPage />)
    expect(await screen.findByText('No emails logged yet')).toBeInTheDocument()
  })

  it('re-fetches the log with the chosen status filter', async () => {
    render(<EmailManagementPage />)
    await screen.findByText('jane@example.com')
    fetchEmailLogMock.mockClear()
    fetchEmailLogMock.mockResolvedValue([LOG_ENTRY])

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failed' } })

    await waitFor(() => expect(fetchEmailLogMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' })))
  })

  it('surfaces a log fetch error', async () => {
    fetchEmailLogMock.mockRejectedValue(new AdminApiError('Could not read email_log.'))
    render(<EmailManagementPage />)
    expect(await screen.findByText('Could not read email_log.')).toBeInTheDocument()
  })

  it('switches to the Templates tab, loads the catalog, and renders a preview on demand', async () => {
    fetchEmailPreviewHtmlMock.mockResolvedValue('<html><body>Hello Jane</body></html>')
    render(<EmailManagementPage />)
    await screen.findByText('jane@example.com')

    fireEvent.click(screen.getByRole('button', { name: 'Templates & test send' }))
    await screen.findByText(/no real customer or booking is ever read here/i)

    fireEvent.click(screen.getByRole('button', { name: 'Load preview' }))

    await waitFor(() => expect(fetchEmailPreviewHtmlMock).toHaveBeenCalledWith('customer', 'booking_confirmed', 'en'))
  })

  it('changing category resets the template selection to the first template in that category', async () => {
    render(<EmailManagementPage />)
    await screen.findByText('jane@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Templates & test send' }))
    await screen.findByText(/no real customer or booking is ever read here/i)

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'admin' } })

    const templateSelect = screen.getByLabelText('Template') as HTMLSelectElement
    expect(templateSelect.value).toBe('admin_booking_received')
  })

  it('disables sending a test until a preview has been loaded, then sends to the entered recipient', async () => {
    fetchEmailPreviewHtmlMock.mockResolvedValue('<html><body>Hello Jane</body></html>')
    sendTestEmailMock.mockResolvedValue({ mode: 'send', sent: true, providerMessageId: 'msg-99' })

    render(<EmailManagementPage />)
    await screen.findByText('jane@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Templates & test send' }))
    await screen.findByText(/no real customer or booking is ever read here/i)

    const sendButton = screen.getByRole('button', { name: 'Send test email' })
    expect(sendButton).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Load preview' }))
    await waitFor(() => expect(fetchEmailPreviewHtmlMock).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Test recipient email'), { target: { value: 'qa@bliss.rent' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send test email' })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: 'Send test email' }))

    await waitFor(() => expect(sendTestEmailMock).toHaveBeenCalledWith('customer', 'booking_confirmed', 'en', 'qa@bliss.rent'))
    expect(await screen.findByText('Test email sent.')).toBeInTheDocument()
  })

  it('surfaces a server-side test-send refusal (e.g. not on the allowlist) as an error, not a silent failure', async () => {
    fetchEmailPreviewHtmlMock.mockResolvedValue('<html><body>Hello Jane</body></html>')
    sendTestEmailMock.mockRejectedValue(new AdminApiError('This recipient is not on the server-side test-send allowlist.'))

    render(<EmailManagementPage />)
    await screen.findByText('jane@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Templates & test send' }))
    await screen.findByText(/no real customer or booking is ever read here/i)

    fireEvent.click(screen.getByRole('button', { name: 'Load preview' }))
    await waitFor(() => expect(fetchEmailPreviewHtmlMock).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Test recipient email'), { target: { value: 'stranger@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send test email' }))

    expect(await screen.findByText('This recipient is not on the server-side test-send allowlist.')).toBeInTheDocument()
  })
})
