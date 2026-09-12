import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chainable } from '@/test/supabaseMock'

const fromMock = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

const adminPaymentsApi = await import('./adminPaymentsApi')
const { fetchPayments } = adminPaymentsApi

describe('adminPaymentsApi', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('lists payments filtered by status (Payment Management)', async () => {
    fromMock.mockReturnValue(chainable({ data: [{ id: 'p1', status: 'paid', amount: 500 }] }))
    const result = await fetchPayments('paid')
    expect(fromMock).toHaveBeenCalledWith('payments')
    expect(result).toHaveLength(1)
  })

  it('lists all payments when no status filter is applied', async () => {
    fromMock.mockReturnValue(chainable({ data: [{ id: 'p1' }, { id: 'p2' }] }))
    const result = await fetchPayments('all')
    expect(result).toHaveLength(2)
  })

  it('is strictly read-only — exposes no write/update function (do NOT create a second payment system)', () => {
    const exportedNames = Object.keys(adminPaymentsApi)
    expect(exportedNames).toEqual(['fetchPayments'])
  })
})
