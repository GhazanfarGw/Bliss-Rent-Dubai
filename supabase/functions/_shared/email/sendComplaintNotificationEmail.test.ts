import { describe, it, expect, vi } from 'vitest'
import {
  sendComplaintNotificationEmailIdempotently,
  type ComplaintNotificationEmailParams,
} from './sendComplaintNotificationEmail.ts'
import type { AdminEmailLogInsertRow, AdminEmailLogStore } from './sendAdminOperationalEmail.ts'
import type { AdminRecipient } from './adminRecipients.ts'

const recipient: AdminRecipient = { id: 'admin-1', name: 'Aisha Owner', email: 'owner@example.com' }

const baseParams: ComplaintNotificationEmailParams = {
  complaintId: 'c1111111-0000-0000-0000-000000000001',
  reporterName: 'Jane Renter',
  reporterEmail: 'jane@example.com',
  subject: 'Late refund',
  description: 'My refund has not arrived yet.',
  recipient,
  language: 'en',
  siteBaseUrl: 'https://bliss.rent',
  dashboardPath: '/admin/complaints',
}

const resendConfig = { apiKey: 'test-key', fromAddress: 'Bliss Rent <noreply@bliss.rent>' }

function createFakeAdminEmailLogStore() {
  const seen = new Map<string, string>()
  let nextId = 1
  const sentIds: string[] = []
  const failedIds: { id: string; reason: string }[] = []
  const rows: AdminEmailLogInsertRow[] = []

  const store: AdminEmailLogStore = {
    async insertIfNew(row) {
      rows.push(row)
      if (seen.has(row.idempotency_key)) {
        return { inserted: false, id: null }
      }
      const id = `log-${nextId++}`
      seen.set(row.idempotency_key, id)
      return { inserted: true, id }
    },
    async markSent(id) {
      sentIds.push(id)
    },
    async markFailed(id, reason) {
      failedIds.push({ id, reason })
    },
  }

  return { store, sentIds, failedIds, rows }
}

describe('sendComplaintNotificationEmailIdempotently', () => {
  it('sends once and records an email_log row with booking_id null', async () => {
    const { store, sentIds, rows } = createFakeAdminEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    const outcome = await sendComplaintNotificationEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)

    expect(outcome).toEqual({ status: 'sent', emailLogId: 'log-1', providerMessageId: 'msg-1' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sentIds).toEqual(['log-1'])
    expect(rows[0].recipient_type).toBe('admin')
    expect(rows[0].booking_id).toBeNull()
    expect(rows[0].event_type).toBe('admin_complaint_received')
  })

  it('gives two different admins for the same complaint distinct idempotency keys — both delivered', async () => {
    const { store, sentIds } = createFakeAdminEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const recipient2: AdminRecipient = { id: 'admin-2', name: 'Omar Staff', email: 'omar@example.com' }

    await sendComplaintNotificationEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)
    await sendComplaintNotificationEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, { ...baseParams, recipient: recipient2 })

    expect(sentIds).toEqual(['log-1', 'log-2'])
  })

  it('skips a duplicate retry for the same complaint + admin', async () => {
    const { store, sentIds } = createFakeAdminEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))

    await sendComplaintNotificationEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)
    const second = await sendComplaintNotificationEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)

    expect(second).toEqual({ status: 'skipped_duplicate' })
    expect(sentIds).toEqual(['log-1'])
  })

  it('records a send failure rather than throwing', async () => {
    const { store, failedIds } = createFakeAdminEmailLogStore()
    const sendEmail = vi.fn(async () => ({ ok: false, errorMessage: 'Resend down' }))

    const outcome = await sendComplaintNotificationEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)

    expect(outcome.status).toBe('send_failed')
    expect(failedIds).toEqual([{ id: 'log-1', reason: 'Resend down' }])
  })

  it('escapes hostile complaint text before it reaches the email body', async () => {
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const { store } = createFakeAdminEmailLogStore()
    let capturedHtml = ''
    sendEmail.mockImplementation(async (_config, params) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })

    await sendComplaintNotificationEmailIdempotently(
      { emailLog: store, resendConfig, sendEmail },
      { ...baseParams, subject: '<script>alert(1)</script>', description: '<img src=x onerror=alert(1)>' },
    )

    expect(capturedHtml).not.toContain('<script>')
    expect(capturedHtml).not.toContain('<img src=x')
  })

  it('renders Arabic content for Arabic', async () => {
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const { store } = createFakeAdminEmailLogStore()
    let capturedHtml = ''
    sendEmail.mockImplementation(async (_config, params) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })

    await sendComplaintNotificationEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, { ...baseParams, language: 'ar' })

    expect(capturedHtml).toContain('dir="rtl"')
  })

  it('isolates the reply-to email address as LTR even inside the Arabic/RTL render — Phase 9K', async () => {
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    const { store } = createFakeAdminEmailLogStore()
    let capturedHtml = ''
    sendEmail.mockImplementation(async (_config, params) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })

    await sendComplaintNotificationEmailIdempotently(
      { emailLog: store, resendConfig, sendEmail },
      { ...baseParams, language: 'ar', reporterEmail: 'jane@example.com' },
    )

    expect(capturedHtml).toContain('direction:ltr')
    expect(capturedHtml).toContain('jane@example.com')
  })

  it('sends to the recipient admin, includes the reply-to email and the dashboard CTA link', async () => {
    let capturedTo = ''
    let capturedHtml = ''
    const sendEmail = vi.fn(async (_config, params) => {
      capturedTo = params.to
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })
    const { store } = createFakeAdminEmailLogStore()

    await sendComplaintNotificationEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)

    expect(capturedTo).toBe('owner@example.com')
    expect(capturedHtml).toContain('jane@example.com')
    expect(capturedHtml).toContain('https://bliss.rent/admin/complaints')
  })

  it('does not render a booking summary card (there is no booking)', async () => {
    let capturedHtml = ''
    const sendEmail = vi.fn(async (_config, params) => {
      capturedHtml = params.html
      return { ok: true, providerMessageId: 'msg-1' }
    })
    const { store } = createFakeAdminEmailLogStore()

    await sendComplaintNotificationEmailIdempotently({ emailLog: store, resendConfig, sendEmail }, baseParams)

    expect(capturedHtml).not.toContain('Reference')
    expect(capturedHtml).not.toContain('Vehicle')
  })
})
