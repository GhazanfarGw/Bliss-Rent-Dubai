import { describe, it, expect } from 'vitest'
import { lastNameMatches } from '@/features/booking/manageBookingVerify'

describe('lastNameMatches', () => {
  it('matches the last word of a two-word name, case-insensitively', () => {
    expect(lastNameMatches('Jane Renter', 'renter')).toBe(true)
    expect(lastNameMatches('Jane Renter', 'RENTER')).toBe(true)
  })

  it('matches a multi-word surname as a suffix', () => {
    expect(lastNameMatches('Ahmed Al Maktoum', 'Al Maktoum')).toBe(true)
  })

  it('tolerates extra surrounding whitespace', () => {
    expect(lastNameMatches('  Jane   Renter  ', '  renter  ')).toBe(true)
  })

  it('rejects an unrelated word', () => {
    expect(lastNameMatches('Jane Renter', 'Smith')).toBe(false)
  })

  it('rejects an empty input', () => {
    expect(lastNameMatches('Jane Renter', '')).toBe(false)
    expect(lastNameMatches('Jane Renter', '   ')).toBe(false)
  })

  it('matches a single-word customer name against itself', () => {
    expect(lastNameMatches('Cher', 'Cher')).toBe(true)
  })
})
