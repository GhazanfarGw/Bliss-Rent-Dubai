// Email preview/testing workflow (Section 22 of the Phase 9 report) —
// the piece of it that belongs to 9B. Running the existing test suite
// (`npm test`) renders every base template with the fake QA data from
// previewData.ts and writes the resulting HTML to email-previews/ at the
// repo root (gitignored — see .gitignore) so it can be opened directly
// in a browser for a visual check. No network call, no real recipient,
// nothing sent — this only ever writes local files during a test run.

import { describe, it, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderCustomerLayout, renderAdminLayout } from './layout.ts'
import { qaCustomerProps, qaAdminProps } from './previewData.ts'

const here = dirname(fileURLToPath(import.meta.url))
const previewDir = resolve(here, '../../../../email-previews')

function writePreview(filename: string, html: string) {
  mkdirSync(previewDir, { recursive: true })
  writeFileSync(resolve(previewDir, filename), html, 'utf8')
}

describe('email template previews (writes to /email-previews for manual QA)', () => {
  it('renders and writes the customer layout in English and Arabic', () => {
    const en = renderCustomerLayout(qaCustomerProps('en'))
    const ar = renderCustomerLayout(qaCustomerProps('ar'))
    writePreview('customer-en.html', en)
    writePreview('customer-ar.html', ar)
    expect(en.length).toBeGreaterThan(0)
    expect(ar.length).toBeGreaterThan(0)
  })

  it('renders and writes the admin layout in English and Arabic', () => {
    const en = renderAdminLayout(qaAdminProps('en'))
    const ar = renderAdminLayout(qaAdminProps('ar'))
    writePreview('admin-en.html', en)
    writePreview('admin-ar.html', ar)
    expect(en.length).toBeGreaterThan(0)
    expect(ar.length).toBeGreaterThan(0)
  })
})
