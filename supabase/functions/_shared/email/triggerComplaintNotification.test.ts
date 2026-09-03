import { describe, it, expect, vi } from 'vitest'
import { triggerComplaintNotification } from './triggerComplaintNotification.ts'
import type { ActiveAdminRow, ActiveAdminsSource } from './adminRecipients.ts'

function fakeAdminsSource(admins: ActiveAdminRow[]): ActiveAdminsSource {
  return {
    from: () => ({ select: () => ({ eq: async () => ({ data: admins, error: null }) }) }),
  } as unknown as ActiveAdminsSource
}

function fakeEmailLog() {
  return {
    async insertIfNew() {
      return { inserted: true, id: 'log-1' }
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
  siteBaseUrl: 'https://bliss.rent',
  resendConfig,
}

describe('triggerComplaintNotification', () => {
  it('never throws when there are zero active admins', async () => {
    await expect(
      triggerComplaintNotification({
        ...baseParams,
        adminsSource: fakeAdminsSource([]),
        getAdminEmail: async () => null,
        emailLog: fakeEmailLog(),
      }),
    ).resolves.toBeUndefined()
  })

  it('never throws when the admins source itself throws', async () => {
    const throwingSource: ActiveAdminsSource = {
      from: () => ({
        select: () => ({
          eq: async () => {
            throw new Error('db down')
          },
        }),
      }),
    } as unknown as ActiveAdminsSource
    await expect(
      triggerComplaintNotification({
        ...baseParams,
        adminsSource: throwingSource,
        getAdminEmail: async () => null,
        emailLog: fakeEmailLog(),
      }),
    ).resolves.toBeUndefined()
  })

  it('never throws when email_log itself throws', async () => {
    const emailLog = {
      async insertIfNew() {
        throw new Error('log insert failed')
      },
      async markSent() {},
      async markFailed() {},
    }
    await expect(
      triggerComplaintNotification({
        ...baseParams,
        adminsSource: fakeAdminsSource([{ id: 'a1', full_name: 'Aisha' }]),
        getAdminEmail: async (id: string) => `${id}@bliss.rent`,
        emailLog,
      }),
    ).resolves.toBeUndefined()
  })

  it('never throws when the send itself fails', async () => {
    await expect(
      triggerComplaintNotification({
        ...baseParams,
        adminsSource: fakeAdminsSource([{ id: 'a1', full_name: 'Aisha' }]),
        getAdminEmail: async (id: string) => `${id}@bliss.rent`,
        emailLog: fakeEmailLog(),
        sendEmail: vi.fn(async () => ({ ok: false, errorMessage: 'boom' })),
      }),
    ).resolves.toBeUndefined()
  })

  it('sends to every active admin on the happy path', async () => {
    const sendEmail = vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' }))
    await triggerComplaintNotification({
      ...baseParams,
      adminsSource: fakeAdminsSource([
        { id: 'a1', full_name: 'Aisha' },
        { id: 'a2', full_name: 'Omar' },
      ]),
      getAdminEmail: async (id: string) => `${id}@bliss.rent`,
      emailLog: fakeEmailLog(),
      sendEmail,
    })
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })
})
