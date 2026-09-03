import { describe, it, expect } from 'vitest'
import { buildManageBookingUrl } from './manageBookingLink.ts'

describe('buildManageBookingUrl', () => {
  it('builds a pre-filled ?ref= link per the confirmed Phase 9A decision', () => {
    expect(buildManageBookingUrl('https://bliss.rent', 'BLS-7F3A9C21')).toBe(
      'https://bliss.rent/manage-booking?ref=BLS-7F3A9C21',
    )
  })

  it('strips a trailing slash on the base URL', () => {
    expect(buildManageBookingUrl('https://bliss.rent/', 'BLS-7F3A9C21')).toBe(
      'https://bliss.rent/manage-booking?ref=BLS-7F3A9C21',
    )
  })

  it('URL-encodes the reference', () => {
    expect(buildManageBookingUrl('https://bliss.rent', 'BLS ABC/1')).toBe(
      'https://bliss.rent/manage-booking?ref=BLS%20ABC%2F1',
    )
  })
})
