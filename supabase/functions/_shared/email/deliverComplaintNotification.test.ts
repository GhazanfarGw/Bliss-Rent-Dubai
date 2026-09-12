import { describe, it, expect, vi } from 'vitest'
import { deliverComplaintNotification, type DeliverComplaintNotificationDeps } from './deliverComplaintNotification.ts'
import type { ActiveAdminRow, ActiveAdminsSource } from './adminRecipients.ts'

function fakeAdminsSource(admins: ActiveAdminRow[]): ActiveAdminsSource {
  return {
    from: () => ({ select: () => ({ eq: async () => ({ data: admins, error: null }) }) }),
  } as unknown as ActiveAdminsSource
}

function fakeEmailLog() {
  const seen = new Map<string, string>()
  let nextId = 1
  return {
    async insertIfNew(row: { idempotency_key: string }) {
      if (seen.has(row.idempotency_key)) return { inserted: false, id: null }
      const id = `log-${nextId++}`
      seen.set(row.idempotency_key, id)
      return { inserted: true, id }
    },
    async markSent() {},
    async markFailed() {},
  }
}

const resendConfig = { apiKey: 'test-key', fromAddress: 'Bliss Rent <noreply@bliss.rent>' }

const baseParams = {
  complaintId: 'c1',
  reporterName: 'Jane Renter',
  reporterEmail: 'jane@example.com',
  subject: 'Late refund',
  description: 'Please help.',
  language: 'en' as const,
  dashboardPath: '/admin/complaints',
}

function deps(admins: ActiveAdminRow[], overrides: Partial<DeliverComplaintNotificationDeps> = {}): DeliverComplaintNotificationDeps {
  return {
    adminsSource: fakeAdminsSource(admins),
    getAdminEmail: async (id: string) => `${id}@bliss.rent`,
    emailLog: fakeEmailLog(),
    resendConfig,
    siteBaseUrl: 'https://bliss.rent',
    sendEmail: vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' })),
    ...overrides,
  }
}

describe('deliverComplaintNotification', () => {
  it('delivers to every active admin', async () => {
    const admins: ActiveAdminRow[] = [
      { id: 'a1', full_name: 'Aisha' },
      { id: 'a2', full_name: 'Omar' },
    ]
    const outcomes = await deliverComplaintNotification(deps(admins), baseParams)
    expect(outcomes).toHaveLength(2)
    expect(outcomes.every((o) => o.status === 'sent')).toBe(true)
  })

  it('isolates one admin send failure from the others', async () => {
    const admins: ActiveAdminRow[] = [
      { id: 'a1', full_name: 'Aisha' },
      { id: 'a2', full_name: 'Omar' },
    ]
    let call = 0
    const sendEmail = vi.fn(async () => {
      call += 1
      if (call === 1) return { ok: false, errorMessage: 'boom' }
      return { ok: true, providerMessageId: 'msg-2' }
    })
    const outcomes = await deliverComplaintNotification(deps(admins, { sendEmail }), baseParams)
    expect(outcomes.map((o) => o.status)).toEqual(['send_failed', 'sent'])
  })

  it('isolates an unexpected thrown error for one admin from the others', async () => {
    const admins: ActiveAdminRow[] = [
      { id: 'a1', full_name: 'Aisha' },
      { id: 'a2', full_name: 'Omar' },
    ]
    const store = fakeEmailLog()
    let call = 0
    const emailLog = {
      ...store,
      async insertIfNew(row: { idempotency_key: string }) {
        call += 1
        if (call === 1) throw new Error('email_log unreachable')
        return store.insertIfNew(row)
      },
    }
    const outcomes = await deliverComplaintNotification(deps(admins, { emailLog }), baseParams)
    expect(outcomes[0].status).toBe('skipped_error')
    expect(outcomes[1].status).toBe('sent')
  })

  it('returns an empty array with zero active admins — a no-op, not an error', async () => {
    const outcomes = await deliverComplaintNotification(deps([]), baseParams)
    expect(outcomes).toEqual([])
  })

  it('is idempotent across two separate calls for the same complaint', async () => {
    const admins: ActiveAdminRow[] = [{ id: 'a1', full_name: 'Aisha' }]
    const sharedDeps = deps(admins)
    await deliverComplaintNotification(sharedDeps, baseParams)
    const second = await deliverComplaintNotification(sharedDeps, baseParams)
    expect(second[0].status).toBe('skipped_duplicate')
  })
})
