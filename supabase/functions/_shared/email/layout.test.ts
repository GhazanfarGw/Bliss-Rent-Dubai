import { describe, it, expect } from 'vitest'
import { renderCustomerLayout, renderAdminLayout } from './layout.ts'
import { qaCustomerProps, qaAdminProps } from './previewData.ts'

describe('renderCustomerLayout', () => {
  it('renders a complete, self-contained HTML document', () => {
    const html = renderCustomerLayout(qaCustomerProps('en'))
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="en" dir="ltr">')
    expect(html).toContain('</html>')
  })

  it('sets dir="rtl" and the Arabic lang attribute for Arabic', () => {
    const html = renderCustomerLayout(qaCustomerProps('ar'))
    expect(html).toContain('<html lang="ar" dir="rtl">')
  })

  it('includes the booking reference, CTA link, and footer in every render', () => {
    const props = qaCustomerProps('en')
    const html = renderCustomerLayout(props)
    expect(html).toContain(props.summary.reference)
    expect(html).toContain(props.ctaUrl)
    expect(html.toLowerCase()).toContain('automated')
  })

  it('renders correctly with no optional extraContentHtml supplied', () => {
    const props = qaCustomerProps('en')
    expect(() => renderCustomerLayout(props)).not.toThrow()
  })

  it('renders correctly with an extraContentHtml section supplied', () => {
    const props = { ...qaCustomerProps('en'), extraContentHtml: '<tr><td>Extra</td></tr>' }
    const html = renderCustomerLayout(props)
    expect(html).toContain('<tr><td>Extra</td></tr>')
  })

  it('omits paymentStatus/bookingStatus rows when the summary does not include them', () => {
    const props = qaCustomerProps('en')
    const { paymentStatusLabel: _p, bookingStatusLabel: _b, ...summaryWithoutStatus } = props.summary
    const html = renderCustomerLayout({ ...props, summary: summaryWithoutStatus })
    expect(html).not.toContain('Payment status')
  })
})

describe('renderAdminLayout', () => {
  it('renders a complete, self-contained HTML document', () => {
    const html = renderAdminLayout(qaAdminProps('en'))
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('Open Admin Dashboard')
  })

  it('renders Arabic admin chrome for Arabic', () => {
    const html = renderAdminLayout(qaAdminProps('ar'))
    expect(html).toContain('<html lang="ar" dir="rtl">')
    expect(html).toContain('فتح لوحة تحكم الإدارة')
  })

  it('omits the required-action block when none is given', () => {
    const html = renderAdminLayout(qaAdminProps('en'))
    expect(html).not.toContain('Required action')
  })

  it('includes the required-action block when one is given', () => {
    const props = { ...qaAdminProps('en'), requiredAction: 'Confirm cash payment collection.' }
    const html = renderAdminLayout(props)
    expect(html).toContain('Required action')
    expect(html).toContain('Confirm cash payment collection.')
  })

  it('renders without a booking summary card when summary is omitted (Phase 9H complaints)', () => {
    const { summary: _summary, ...propsWithoutSummary } = qaAdminProps('en')
    const html = renderAdminLayout(propsWithoutSummary)
    expect(html).not.toContain('Reference')
    expect(() => renderAdminLayout(propsWithoutSummary)).not.toThrow()
  })

  it('renders detailsHtml in place of the booking summary card when provided', () => {
    const { summary: _summary, ...propsWithoutSummary } = qaAdminProps('en')
    const html = renderAdminLayout({ ...propsWithoutSummary, detailsHtml: '<tr><td>Complaint subject here</td></tr>' })
    expect(html).toContain('Complaint subject here')
  })

  it('renders the no-summary/detailsHtml (Phase 9H complaint) path correctly in Arabic/RTL — Phase 9K', () => {
    const { summary: _summary, ...propsWithoutSummary } = qaAdminProps('ar')
    const html = renderAdminLayout({ ...propsWithoutSummary, detailsHtml: '<tr><td dir="rtl">موضوع الشكوى هنا</td></tr>' })
    expect(html).toContain('<html lang="ar" dir="rtl">')
    expect(html).toContain('موضوع الشكوى هنا')
    expect(html).not.toContain('Reference')
  })
})
