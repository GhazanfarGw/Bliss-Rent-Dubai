import { describe, it, expect, vi } from 'vitest'
import { resolveAdminRecipients, AdminRecipientsSourceError, type ActiveAdminsSource } from './adminRecipients.ts'

function fakeSource(rows: { id: string; full_name: string }[] | null, error: { message: string } | null = null): ActiveAdminsSource {
  return {
    from: (table) => {
      if (table !== 'admin_profiles') throw new Error(`unexpected table: ${table}`)
      return {
        select: () => ({
          eq: async () => ({ data: rows, error }),
        }),
      }
    },
  }
}

describe('resolveAdminRecipients', () => {
  it('resolves every active admin to their real Auth email', async () => {
    const source = fakeSource([
      { id: 'admin-1', full_name: 'Aisha Owner' },
      { id: 'admin-2', full_name: 'Karim Staff' },
    ])
    const getAdminEmail = vi.fn(async (id: string) => (id === 'admin-1' ? 'owner@example.com' : 'staff@example.com'))

    const result = await resolveAdminRecipients(source, getAdminEmail)

    expect(result).toEqual([
      { id: 'admin-1', name: 'Aisha Owner', email: 'owner@example.com' },
      { id: 'admin-2', name: 'Karim Staff', email: 'staff@example.com' },
    ])
  })

  it('queries only active admin_profiles rows (is_active = true)', async () => {
    const eqSpy = vi.fn(async () => ({ data: [], error: null }))
    const source: ActiveAdminsSource = { from: () => ({ select: () => ({ eq: eqSpy }) }) }
    await resolveAdminRecipients(source, vi.fn())
    expect(eqSpy).toHaveBeenCalledWith('is_active', true)
  })

  it('skips an admin whose email lookup returns null, without failing the whole list', async () => {
    const source = fakeSource([
      { id: 'admin-1', full_name: 'Aisha Owner' },
      { id: 'admin-2', full_name: 'Ghost Account' },
    ])
    const getAdminEmail = vi.fn(async (id: string) => (id === 'admin-1' ? 'owner@example.com' : null))

    const result = await resolveAdminRecipients(source, getAdminEmail)

    expect(result).toEqual([{ id: 'admin-1', name: 'Aisha Owner', email: 'owner@example.com' }])
  })

  it('falls back to "Admin" when full_name is blank', async () => {
    const source = fakeSource([{ id: 'admin-1', full_name: '  ' }])
    const result = await resolveAdminRecipients(source, async () => 'owner@example.com')
    expect(result[0].name).toBe('Admin')
  })

  it('normalizes email casing/whitespace and dedupes if two rows resolve to the same address', async () => {
    const source = fakeSource([
      { id: 'admin-1', full_name: 'Aisha Owner' },
      { id: 'admin-2', full_name: 'Duplicate Login' },
    ])
    const getAdminEmail = vi.fn(async () => '  Owner@Example.com  ')
    const result = await resolveAdminRecipients(source, getAdminEmail)
    expect(result).toEqual([{ id: 'admin-1', name: 'Aisha Owner', email: 'owner@example.com' }])
  })

  it('returns an empty array when there are no active admins', async () => {
    const source = fakeSource([])
    const result = await resolveAdminRecipients(source, vi.fn())
    expect(result).toEqual([])
  })

  it('returns an empty array when the query itself returns null data', async () => {
    const source = fakeSource(null)
    const result = await resolveAdminRecipients(source, vi.fn())
    expect(result).toEqual([])
  })

  it('propagates a real database error rather than silently returning an empty list', async () => {
    const source = fakeSource(null, { message: 'permission denied for table admin_profiles' })
    await expect(resolveAdminRecipients(source, vi.fn())).rejects.toBeInstanceOf(AdminRecipientsSourceError)
  })
})
