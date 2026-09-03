import { describe, it, expect, vi } from 'vitest'
import { handleSendRentalRemindersRequest, SendRentalRemindersError } from './logic.ts'
import type { RentalReminderDataSource } from '../_shared/email/rentalReminders.ts'

function emptyDataSource(): RentalReminderDataSource {
  return {
    from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }) }),
  } as unknown as RentalReminderDataSource
}

function baseDeps() {
  return {
    dataSource: emptyDataSource(),
    emailLog: { async insertIfNew() { return { inserted: true, id: 'log-1' } }, async markSent() {}, async markFailed() {} },
    resendConfig: { apiKey: 'k', fromAddress: 'Bliss Rent <noreply@bliss.rent>' },
    siteBaseUrl: 'https://bliss.rent',
    sendEmail: vi.fn(async () => ({ ok: true, providerMessageId: 'msg-1' })),
  }
}

describe('handleSendRentalRemindersRequest', () => {
  it('rejects a missing Authorization header', async () => {
    await expect(handleSendRentalRemindersRequest(null, 'secret123', baseDeps())).rejects.toThrow(SendRentalRemindersError)
  })

  it('rejects a wrong secret', async () => {
    await expect(handleSendRentalRemindersRequest('Bearer wrong', 'secret123', baseDeps())).rejects.toThrow(SendRentalRemindersError)
  })

  it('rejects when CRON_SECRET itself is not configured — fails closed, not open', async () => {
    await expect(handleSendRentalRemindersRequest('Bearer anything', undefined, baseDeps())).rejects.toThrow(SendRentalRemindersError)
  })

  it('accepts the correct secret and returns a zero-outcome summary when nothing is due', async () => {
    const result = await handleSendRentalRemindersRequest('Bearer secret123', 'secret123', baseDeps())
    expect(result).toEqual({ sent: 0, skipped: 0, failed: 0, outcomes: [] })
  })

  it('summarizes sent/skipped/failed counts correctly', async () => {
    const dataSource: RentalReminderDataSource = {
      from: () => ({
        select: () => ({
          eq: (col1: string) => ({
            eq: async (col2: string) => {
              if (col1 === 'status' && col2 === 'start_date') {
                return {
                  data: [
                    {
                      id: 'b1',
                      status: 'confirmed',
                      start_date: '2026-09-10',
                      end_date: '2026-09-15',
                      total_price: 750,
                      currency: 'AED',
                      customers: { full_name: 'Jane', email: 'jane@example.com' },
                      vehicles: { make: 'Toyota', model: 'Camry' },
                      pickup_location: { name: 'DXB' },
                      dropoff_location: { name: 'DXB' },
                    },
                  ],
                  error: null,
                }
              }
              return { data: [], error: null }
            },
          }),
        }),
      }),
    } as unknown as RentalReminderDataSource

    const result = await handleSendRentalRemindersRequest('Bearer secret123', 'secret123', { ...baseDeps(), dataSource })
    expect(result.sent).toBe(1)
    expect(result.outcomes).toHaveLength(1)
  })
})
