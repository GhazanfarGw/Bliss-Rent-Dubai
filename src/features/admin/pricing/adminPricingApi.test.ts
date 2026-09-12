import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chainable } from '@/test/supabaseMock'
import { ALL_TERMS, buildPricingDrafts } from './adminPricingApi'

const fromMock = vi.fn()
let lastUpsertRows: Record<string, unknown>[] | null = null

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

const { savePricingLadder } = await import('./adminPricingApi')

describe('buildPricingDrafts', () => {
  it('builds one draft per term, pre-filled from existing pricing rows', () => {
    const drafts = buildPricingDrafts([
      { id: 'p1', vehicle_id: 'v1', term: 'daily', list_price: 300, client_price: 250, currency: 'AED', created_at: '' },
    ])
    expect(drafts).toHaveLength(ALL_TERMS.length)
    const daily = drafts.find((d) => d.term === 'daily')
    expect(daily?.listPrice).toBe('300')
    expect(daily?.clientPrice).toBe('250')
    const weekly = drafts.find((d) => d.term === 'weekly')
    expect(weekly?.listPrice).toBe('')
  })
})

describe('savePricingLadder', () => {
  beforeEach(() => {
    fromMock.mockReset()
    lastUpsertRows = null
  })

  it('upserts only the terms the admin actually filled in (Pricing Management)', async () => {
    fromMock.mockImplementation(() => ({
      upsert: (rows: Record<string, unknown>[]) => {
        lastUpsertRows = rows
        return chainable({ data: null, error: null })
      },
    }))

    await savePricingLadder('v1', [
      { id: null, term: 'daily', listPrice: '300', clientPrice: '250' },
      { id: null, term: 'weekly', listPrice: '', clientPrice: '' },
    ])

    expect(lastUpsertRows).toHaveLength(1)
    expect(lastUpsertRows?.[0]).toMatchObject({ vehicle_id: 'v1', term: 'daily', list_price: 300, client_price: 250 })
    // Regression guard: a brand-new row (no existing id) must not carry an
    // `id` key at all — not even set to `undefined` — or the Supabase client
    // tells PostgREST to expect one, which sends an explicit NULL instead of
    // leaving the column out for pricing.id's default to fill in.
    expect(Object.keys(lastUpsertRows![0])).not.toContain('id')
  })

  it('includes id only when updating an existing pricing row', async () => {
    fromMock.mockImplementation(() => ({
      upsert: (rows: Record<string, unknown>[]) => {
        lastUpsertRows = rows
        return chainable({ data: null, error: null })
      },
    }))

    await savePricingLadder('v1', [{ id: 'existing-row-id', term: 'daily', listPrice: '300', clientPrice: '250' }])

    expect(lastUpsertRows?.[0]).toMatchObject({ id: 'existing-row-id', vehicle_id: 'v1', term: 'daily' })
  })

  it('does nothing (no network call) when the whole ladder is left blank', async () => {
    await savePricingLadder('v1', [{ id: null, term: 'daily', listPrice: '', clientPrice: '' }])
    expect(fromMock).not.toHaveBeenCalled()
  })
})
