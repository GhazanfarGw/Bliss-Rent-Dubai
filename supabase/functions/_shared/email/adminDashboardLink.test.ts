import { describe, it, expect } from 'vitest'
import { buildAdminDashboardUrl } from './adminDashboardLink.ts'

describe('buildAdminDashboardUrl', () => {
  it('joins the site base URL and path with exactly one slash', () => {
    expect(buildAdminDashboardUrl('https://bliss.rent', '/admin/bookings/b-1')).toBe('https://bliss.rent/admin/bookings/b-1')
  })

  it('strips a trailing slash from the base URL', () => {
    expect(buildAdminDashboardUrl('https://bliss.rent/', '/admin/extensions')).toBe('https://bliss.rent/admin/extensions')
  })

  it('adds a leading slash to the path if the caller omits it', () => {
    expect(buildAdminDashboardUrl('https://bliss.rent', 'admin/extensions')).toBe('https://bliss.rent/admin/extensions')
  })
})
