import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escape.ts'

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert('x')</script> & "quoted"`)).toBe(
      '&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;quoted&quot;',
    )
  })

  it('passes plain text through unchanged', () => {
    expect(escapeHtml('Jane Renter')).toBe('Jane Renter')
  })

  it('coerces numbers to strings', () => {
    expect(escapeHtml(750)).toBe('750')
  })

  it('returns an empty string for null/undefined rather than "null"/"undefined"', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('neutralizes a script-injection attempt in a free-text field (e.g. a complaint body)', () => {
    const malicious = '"><img src=x onerror=alert(1)>'
    const escaped = escapeHtml(malicious)
    expect(escaped).not.toContain('<img')
    expect(escaped).not.toContain('">')
  })
})
