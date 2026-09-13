import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chainable } from '@/test/supabaseMock'

const fromMock = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}))

const adminFeedbackApi = await import('./adminFeedbackApi')
const { fetchSiteFeedback } = adminFeedbackApi

describe('adminFeedbackApi', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('lists feedback newest first and computes the average rating', async () => {
    fromMock.mockReturnValue(
      chainable({
        data: [
          { id: 'f1', rating: 5, message: 'Great!', page_path: '/search', locale: 'en', created_at: '2026-09-02' },
          { id: 'f2', rating: 3, message: null, page_path: '/about', locale: 'ar', created_at: '2026-09-01' },
        ],
      }),
    )
    const result = await fetchSiteFeedback()
    expect(fromMock).toHaveBeenCalledWith('site_feedback')
    expect(result.count).toBe(2)
    expect(result.averageRating).toBe(4)
    expect(result.feedback).toHaveLength(2)
  })

  it('reports a null average (not zero) when there is no feedback yet', async () => {
    fromMock.mockReturnValue(chainable({ data: [] }))
    const result = await fetchSiteFeedback()
    expect(result.count).toBe(0)
    expect(result.averageRating).toBeNull()
  })

  it('is strictly read-only — exposes no write function', () => {
    expect(Object.keys(adminFeedbackApi)).toEqual(['fetchSiteFeedback'])
  })
})
