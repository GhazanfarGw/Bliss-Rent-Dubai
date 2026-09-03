import { describe, it, expect } from 'vitest'
import {
  CUSTOMER_EVENT_TYPES,
  listPreviewCatalog,
  renderCustomerEventPreview,
  renderAdminEventPreview,
  renderComplaintEventPreview,
  renderPreview,
  UnknownPreviewTemplateError,
} from './previewRenderer.ts'
import { ADMIN_OPERATIONAL_EVENT_TYPES } from './adminOperationalEmailContent.ts'

describe('listPreviewCatalog', () => {
  it('lists every customer event, every admin operational event, and the one complaint event', () => {
    const catalog = listPreviewCatalog()
    const customerEntries = catalog.filter((e) => e.category === 'customer')
    const adminEntries = catalog.filter((e) => e.category === 'admin')
    const complaintEntries = catalog.filter((e) => e.category === 'complaint')

    expect(customerEntries.map((e) => e.eventType)).toEqual(CUSTOMER_EVENT_TYPES)
    expect(adminEntries.map((e) => e.eventType)).toEqual(ADMIN_OPERATIONAL_EVENT_TYPES)
    expect(complaintEntries).toHaveLength(1)
    expect(complaintEntries[0].eventType).toBe('admin_complaint_received')
  })

  it('never lists any of the 4 extension/reassignment templates — deliberately out of scope for this first pass', () => {
    const catalog = listPreviewCatalog()
    const eventTypes = catalog.map((e) => e.eventType)
    expect(eventTypes).not.toContain('extension_approved')
    expect(eventTypes).not.toContain('extension_rejected')
    expect(eventTypes).not.toContain('extension_conflict_pending_review')
    expect(eventTypes).not.toContain('vehicle_reassigned')
  })
})

describe('renderCustomerEventPreview', () => {
  it.each(CUSTOMER_EVENT_TYPES)('renders %s in English with the QA reference and no fatal error', (eventType) => {
    const html = renderCustomerEventPreview(eventType, 'en')
    expect(html).toContain('BLS-7F3A9C21')
    expect(html).toContain('<html')
  })

  it.each(CUSTOMER_EVENT_TYPES)('renders %s in Arabic/RTL with the QA reference', (eventType) => {
    const html = renderCustomerEventPreview(eventType, 'ar')
    expect(html).toContain('BLS-7F3A9C21')
    expect(html).toMatch(/dir=["']rtl["']/)
  })
})

describe('renderAdminEventPreview', () => {
  it.each(ADMIN_OPERATIONAL_EVENT_TYPES)('renders %s in English with the QA customer name and dashboard link', (eventType) => {
    const html = renderAdminEventPreview(eventType, 'en')
    expect(html).toContain('Jane Renter (QA data)')
    expect(html).toContain('/admin/bookings')
  })

  it.each(ADMIN_OPERATIONAL_EVENT_TYPES)('renders %s in Arabic/RTL with the QA customer name', (eventType) => {
    const html = renderAdminEventPreview(eventType, 'ar')
    expect(html).toContain('محمد أحمد (بيانات تجريبية)')
    expect(html).toMatch(/dir=["']rtl["']/)
  })
})

describe('renderComplaintEventPreview', () => {
  it('renders the English complaint preview with fake subject/message/reply-to, no real booking summary', () => {
    const html = renderComplaintEventPreview('en')
    expect(html).toContain('Late refund (QA data)')
    expect(html).toContain('jane@example.com')
    expect(html).toContain('/admin/complaints')
    // No booking summary card content — this is a bookingless complaint alert.
    expect(html).not.toContain('BLS-7F3A9C21')
  })

  it('renders the Arabic/RTL complaint preview with fake subject/message', () => {
    const html = renderComplaintEventPreview('ar')
    expect(html).toContain('استرداد متأخر (بيانات تجريبية)')
    expect(html).toMatch(/dir=["']rtl["']/)
  })
})

describe('renderPreview dispatch', () => {
  it('dispatches a valid customer event', () => {
    const html = renderPreview('customer', 'booking_confirmed', 'en')
    expect(html).toContain('BLS-7F3A9C21')
  })

  it('dispatches a valid admin event', () => {
    const html = renderPreview('admin', 'admin_booking_received', 'en')
    expect(html).toContain('Jane Renter (QA data)')
  })

  it('dispatches the complaint category regardless of eventType value', () => {
    const html = renderPreview('complaint', 'admin_complaint_received', 'en')
    expect(html).toContain('jane@example.com')
  })

  it('throws UnknownPreviewTemplateError for an unrecognized customer event type', () => {
    expect(() => renderPreview('customer', 'not_a_real_event', 'en')).toThrow(UnknownPreviewTemplateError)
  })

  it('throws UnknownPreviewTemplateError for an unrecognized admin event type', () => {
    expect(() => renderPreview('admin', 'not_a_real_event', 'en')).toThrow(UnknownPreviewTemplateError)
  })

  it('throws UnknownPreviewTemplateError for an unrecognized category', () => {
    expect(() => renderPreview('not_a_category' as never, 'anything', 'en')).toThrow(UnknownPreviewTemplateError)
  })
})
