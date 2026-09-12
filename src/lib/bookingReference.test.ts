import { describe, it, expect } from 'vitest'
import { formatBookingReference } from '@/lib/bookingReference'

describe('formatBookingReference', () => {
  it('matches the server-side formula (BLS- + first 8 hex chars of the id, uppercased)', () => {
    expect(formatBookingReference('d300ac89-03b4-4f51-93b9-49b7c3f235d7')).toBe('BLS-D300AC89')
  })
})
