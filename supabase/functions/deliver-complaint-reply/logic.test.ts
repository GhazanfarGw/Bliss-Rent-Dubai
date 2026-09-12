import { describe, it, expect, vi } from 'vitest'
import { handleDeliverComplaintReply, DeliverComplaintReplyError, type DeliverComplaintReplyDeps } from './logic.ts'
import type { ComplaintReplyRow } from '../_shared/email/complaintReplyData.ts'

const baseRow: ComplaintReplyRow = {
  id: 'c1',
  booking_id: null,
  subject: 'Late delivery',
  description: 'My car was delivered 2 hours late.',
  admin_reply_message: 'Sorry about that — we have credited your account AED 50.',
  admin_reply_sent_at: '2026-09-11T10:00:00Z',
  customers: { full_name: 'Jane Renter', email: 'jane@example.com' },
}

function fakeDeps(overrides: Partial<DeliverComplaintReplyDeps> = {}, row: ComplaintReplyRow | null = baseRow): DeliverComplaintReplyDeps {
  return {
    getCallerUserId: vi.fn(async () => 'admin-1'),
    getCallerProfile: vi.fn(async () => ({ role: 'super_admin', is_active: true })),
    dataSource: {
      from: (table: string) => {
        if (table !== 'complaints') throw new Error(`unexpected table: ${table}`)
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: row, error: null }),
            }),
          }),
        }
      },
    } as never,
    emailLog: {
      insertIfNew: vi.fn(async () => ({ inserted: true, id: 'log-1' })),
      markSent: vi.fn(async () => {}),
      markFailed: vi.fn(async () => {}),
    },
    resendConfig: { apiKey: 'key', fromAddress: 'Bliss Rent <booking@bliss.rent>' },
    siteBaseUrl: 'https://bliss.rent',
    sendEmail: vi.fn(async () => ({ ok: true, providerMessageId: 'resend-1' })),
    ...overrides,
  }
}

describe('handleDeliverComplaintReply', () => {
  it('requires an Authorization header', async () => {
    await expect(handleDeliverComplaintReply(null, { complaintId: 'c1' }, fakeDeps())).rejects.toThrow(DeliverComplaintReplyError)
  })

  it('rejects an inactive/non-admin caller', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => ({ role: 'staff', is_active: false })) })
    await expect(handleDeliverComplaintReply('Bearer t', { complaintId: 'c1' }, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('allows an active staff member (not just super_admin)', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => ({ role: 'staff', is_active: true })) })
    const result = await handleDeliverComplaintReply('Bearer t', { complaintId: 'c1' }, deps)
    expect(result.outcome.status).toBe('sent')
  })

  it('requires complaintId', async () => {
    await expect(handleDeliverComplaintReply('Bearer t', {}, fakeDeps())).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('sends the reply email, keyed by the complaint id + admin_reply_sent_at', async () => {
    const deps = fakeDeps()
    const result = await handleDeliverComplaintReply('Bearer t', { complaintId: 'c1' }, deps)
    expect(result.outcome).toMatchObject({ status: 'sent' })
    expect(deps.emailLog.insertIfNew).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotency_key: 'complaint:c1:admin_complaint_reply:2026-09-11T10:00:00Z',
        recipient_type: 'customer',
        recipient_email: 'jane@example.com',
        booking_id: null,
      }),
    )
  })

  it('is a no-op when no reply has been saved yet — never an error', async () => {
    const row: ComplaintReplyRow = { ...baseRow, admin_reply_message: null, admin_reply_sent_at: null }
    const deps = fakeDeps({}, row)
    const result = await handleDeliverComplaintReply('Bearer t', { complaintId: 'c1' }, deps)
    expect(result.outcome).toEqual({ status: 'skipped_no_reply' })
    expect(deps.emailLog.insertIfNew).not.toHaveBeenCalled()
  })

  it('skips (never throws) when the customer has no usable email', async () => {
    const row: ComplaintReplyRow = { ...baseRow, customers: { full_name: 'Jane', email: '' } }
    const deps = fakeDeps({}, row)
    const result = await handleDeliverComplaintReply('Bearer t', { complaintId: 'c1' }, deps)
    expect(result.outcome.status).toBe('skipped_no_recipient')
  })

  it('a retried notify call for the same saved reply skips as a duplicate (idempotent)', async () => {
    const deps = fakeDeps({ emailLog: { insertIfNew: vi.fn(async () => ({ inserted: false, id: null })), markSent: vi.fn(), markFailed: vi.fn() } })
    const result = await handleDeliverComplaintReply('Bearer t', { complaintId: 'c1' }, deps)
    expect(result.outcome).toEqual({ status: 'skipped_duplicate' })
    expect(deps.sendEmail).not.toHaveBeenCalled()
  })

  it('defaults to English and honors an explicit Arabic language', async () => {
    const deps = fakeDeps()
    await handleDeliverComplaintReply('Bearer t', { complaintId: 'c1', language: 'ar' }, deps)
    const [, params] = (deps.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(params.subject).toBe('رد بليس رنت على رسالتك')
  })
})
