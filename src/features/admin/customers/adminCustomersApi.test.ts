import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chainable } from '@/test/supabaseMock'

const fromMock = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

const { fetchCustomers, fetchCustomerById } = await import('./adminCustomersApi')

describe('adminCustomersApi', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('lists customers with booking counts computed from real rows, not invented (Customer Management)', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'customers') {
        return chainable({ data: [{ id: 'c1', full_name: 'Jane Renter' }] })
      }
      if (table === 'bookings') {
        return chainable({
          data: [
            { customer_id: 'c1', status: 'completed' },
            { customer_id: 'c1', status: 'active' },
          ],
        })
      }
      throw new Error(`unexpected table ${table}`)
    })

    const customers = await fetchCustomers()
    expect(customers).toHaveLength(1)
    expect(customers[0].booking_count).toBe(2)
    expect(customers[0].active_booking_count).toBe(1)
  })

  it('reports zero bookings for a customer with none, rather than omitting them', async () => {
    fromMock.mockImplementation((table: string) => (table === 'customers' ? chainable({ data: [{ id: 'c2' }] }) : chainable({ data: [] })))
    const customers = await fetchCustomers()
    expect(customers[0].booking_count).toBe(0)
    expect(customers[0].active_booking_count).toBe(0)
  })

  it('returns null for an unknown customer id instead of throwing', async () => {
    fromMock.mockReturnValue(chainable({ data: null }))
    const customer = await fetchCustomerById('nope')
    expect(customer).toBeNull()
  })
})
