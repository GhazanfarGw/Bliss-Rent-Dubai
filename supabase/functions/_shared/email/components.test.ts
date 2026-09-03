import { describe, it, expect } from 'vitest'
import {
  wrapLtr,
  renderHeader,
  renderStatusBanner,
  renderBookingSummaryCard,
  renderDetailsCard,
  renderCtaButton,
  renderFooter,
  renderAdminBar,
  renderRequiredAction,
} from './components.ts'
import { PLACEHOLDER_CONTACT } from './brand.ts'
import type { BookingSummary } from './types.ts'

const summary: BookingSummary = {
  reference: 'BLS-7F3A9C21',
  vehicleName: 'Toyota Camry 2026',
  rentalDatesLabel: '10 Sep 2026 – 15 Sep 2026',
  pickupLabel: 'DXB Airport',
  dropoffLabel: 'DXB Airport',
  amountLabel: 'AED 750.00',
}

describe('wrapLtr', () => {
  it('wraps the value in an LTR-forcing inline-style span, mirroring the app .ltr-nums convention', () => {
    const html = wrapLtr('BLS-7F3A9C21')
    expect(html).toContain('direction:ltr')
    expect(html).toContain('unicode-bidi:isolate')
    expect(html).toContain('BLS-7F3A9C21')
  })

  it('escapes its input', () => {
    expect(wrapLtr('<b>x</b>')).not.toContain('<b>')
  })
})

describe('renderHeader', () => {
  it('renders LTR for English', () => {
    const html = renderHeader('en')
    expect(html).toContain('dir="ltr"')
    expect(html).toContain('Bliss Rent')
  })

  it('renders RTL and the Arabic wordmark for Arabic', () => {
    const html = renderHeader('ar')
    expect(html).toContain('dir="rtl"')
    expect(html).toContain('بليس رنت')
  })
})

describe('renderStatusBanner', () => {
  it('escapes the message', () => {
    const html = renderStatusBanner('success', '<script>x</script>', 'en')
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('renderBookingSummaryCard', () => {
  it('includes every required field for English', () => {
    const html = renderBookingSummaryCard(summary, 'en')
    expect(html).toContain('Reference')
    expect(html).toContain(summary.vehicleName)
    expect(html).toContain('AED 750.00')
  })

  it('omits optional payment/booking status rows when not provided', () => {
    const html = renderBookingSummaryCard(summary, 'en')
    expect(html).not.toContain('Payment status')
    expect(html).not.toContain('Booking status')
  })

  it('includes optional rows when provided', () => {
    const html = renderBookingSummaryCard({ ...summary, paymentStatusLabel: 'Paid', bookingStatusLabel: 'Confirmed' }, 'en')
    expect(html).toContain('Payment status')
    expect(html).toContain('Paid')
  })

  it('escapes a hostile vehicle name rather than injecting it raw', () => {
    const html = renderBookingSummaryCard({ ...summary, vehicleName: '<img src=x onerror=alert(1)>' }, 'en')
    expect(html).not.toContain('<img')
  })

  it('renders Arabic labels for Arabic', () => {
    const html = renderBookingSummaryCard(summary, 'ar')
    expect(html).toContain('رقم الحجز')
    expect(html).toContain('السيارة')
  })
})

describe('renderDetailsCard', () => {
  it('renders every label/value row', () => {
    const html = renderDetailsCard([{ label: 'Subject', value: 'Late refund' }, { label: 'Message', value: 'Please help.' }], 'en')
    expect(html).toContain('Subject')
    expect(html).toContain('Late refund')
    expect(html).toContain('Message')
    expect(html).toContain('Please help.')
  })

  it('escapes hostile free-text values', () => {
    const html = renderDetailsCard([{ label: 'Message', value: '<script>alert(1)</script>' }], 'en')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('renders RTL for Arabic', () => {
    const html = renderDetailsCard([{ label: 'الموضوع', value: 'استرداد متأخر' }], 'ar')
    expect(html).toContain('dir="rtl"')
    expect(html).toContain('الموضوع')
  })

  it('renders an empty card without throwing for zero rows', () => {
    expect(() => renderDetailsCard([], 'en')).not.toThrow()
  })

  it('isolates an ltrValue row (e.g. a reply-to email address) with wrapLtr, even in an RTL card — Phase 9K', () => {
    const html = renderDetailsCard([{ label: 'الرد على', value: 'jane@example.com', ltrValue: true }], 'ar')
    expect(html).toContain('direction:ltr')
    expect(html).toContain('jane@example.com')
  })

  it('does not force LTR isolation on an ordinary free-text row', () => {
    const html = renderDetailsCard([{ label: 'Message', value: 'Please help.' }], 'en')
    expect(html).not.toContain('direction:ltr')
  })
})

describe('renderCtaButton', () => {
  it('escapes a quote in the URL so it cannot break out of the href attribute', () => {
    const html = renderCtaButton('https://bliss.rent/manage-booking?ref=BLS-1" onmouseover="alert(1)', 'Click', 'en')
    // The raw double-quote must not survive unescaped — that's what would
    // let the attacker-supplied text become a live onmouseover attribute
    // instead of an inert part of the href value.
    expect(html).not.toContain('1" onmouseover="alert')
    expect(html).toContain('&quot; onmouseover=&quot;')
  })

  it('escapes the label', () => {
    const html = renderCtaButton('https://bliss.rent', '<b>Click</b>', 'en')
    expect(html).not.toContain('<b>Click</b>')
    expect(html).toContain('&lt;b&gt;Click&lt;/b&gt;')
  })
})

describe('renderFooter', () => {
  it('marks placeholder contact info as a placeholder rather than presenting it as real', () => {
    const html = renderFooter('en')
    expect(html).toContain(PLACEHOLDER_CONTACT.email)
    expect(html).toContain('(placeholder)')
  })

  it('includes the automated-message notice', () => {
    const html = renderFooter('en')
    expect(html.toLowerCase()).toContain('automated')
  })
})

describe('renderAdminBar', () => {
  it('shows the urgent priority label for Arabic', () => {
    const html = renderAdminBar('New booking received', 'urgent', 'ar')
    expect(html).toContain('عاجل')
  })
})

describe('renderRequiredAction', () => {
  it('escapes the action text', () => {
    const html = renderRequiredAction('<b>Approve</b> this request', 'en')
    expect(html).not.toContain('<b>Approve</b>')
  })
})
