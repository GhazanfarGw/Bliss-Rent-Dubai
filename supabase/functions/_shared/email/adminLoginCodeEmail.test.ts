import { describe, it, expect } from 'vitest'
import { renderAdminLoginCodeEmail } from './adminLoginCodeEmail.ts'

describe('renderAdminLoginCodeEmail', () => {
  it('includes the code and expiry in English', () => {
    const content = renderAdminLoginCodeEmail('en', '042917', 10)
    expect(content.html).toContain('042917')
    expect(content.html).toContain('10 minutes')
    expect(content.subject).toContain('sign-in code')
  })

  it('includes the code and expiry in Arabic', () => {
    const content = renderAdminLoginCodeEmail('ar', '042917', 10)
    expect(content.html).toContain('042917')
    expect(content.html).toContain('10 دقائق')
    expect(content.html).toContain('dir="rtl"')
  })

  it('escapes a code containing HTML-significant characters rather than injecting them raw', () => {
    // Codes are always 6 digits in practice, but this module only
    // renders whatever it's given — defense in depth, matching the
    // escapeHtml convention used everywhere else in this email system.
    const content = renderAdminLoginCodeEmail('en', '<b>1</b>', 10)
    expect(content.html).not.toContain('<b>1</b>')
    expect(content.html).toContain('&lt;b&gt;1&lt;/b&gt;')
  })
})
