import { describe, it, expect } from 'vitest'
import { getCustomerEmailContent, type CustomerBookingEventType } from './customerEmailContent.ts'

const EVENT_TYPES: CustomerBookingEventType[] = [
  'booking_received',
  'booking_confirmed',
  'payment_failed',
  'booking_cancelled',
  'pickup_reminder',
  'return_reminder',
]

describe('getCustomerEmailContent', () => {
  it.each(EVENT_TYPES)('returns complete EN content for %s', (eventType) => {
    const content = getCustomerEmailContent(eventType, 'en')
    expect(content.subject.length).toBeGreaterThan(0)
    expect(content.title.length).toBeGreaterThan(0)
    expect(content.message.length).toBeGreaterThan(0)
    expect(content.statusMessage.length).toBeGreaterThan(0)
  })

  it.each(EVENT_TYPES)('returns complete AR content for %s', (eventType) => {
    const content = getCustomerEmailContent(eventType, 'ar')
    expect(content.subject.length).toBeGreaterThan(0)
    expect(content.title.length).toBeGreaterThan(0)
    expect(content.message.length).toBeGreaterThan(0)
    expect(content.statusMessage.length).toBeGreaterThan(0)
  })

  it('uses success tone for booking_confirmed and danger tone for payment_failed', () => {
    expect(getCustomerEmailContent('booking_confirmed', 'en').statusTone).toBe('success')
    expect(getCustomerEmailContent('payment_failed', 'en').statusTone).toBe('danger')
  })

  it('reuses the exact confirmation-page wording for booking_confirmed/booking_received titles', () => {
    expect(getCustomerEmailContent('booking_confirmed', 'en').title).toBe('Booking confirmed')
    expect(getCustomerEmailContent('booking_confirmed', 'ar').title).toBe('تم تأكيد الحجز')
    expect(getCustomerEmailContent('booking_received', 'en').title).toBe('Booking received')
    expect(getCustomerEmailContent('booking_received', 'ar').title).toBe('تم استلام الحجز')
  })

  it('does not mention a cancellation reason (Phase 9A decision: ship reason-less for now)', () => {
    const en = getCustomerEmailContent('booking_cancelled', 'en').message.toLowerCase()
    const ar = getCustomerEmailContent('booking_cancelled', 'ar').message
    expect(en).not.toContain('reason')
    expect(ar).not.toContain('سبب')
  })

  it('reminder emails are purely informational — no fee/penalty amount invented', () => {
    const pickup = getCustomerEmailContent('pickup_reminder', 'en').message.toLowerCase()
    const ret = getCustomerEmailContent('return_reminder', 'en').message.toLowerCase()
    expect(pickup).not.toMatch(/fee|penalty|charge/)
    expect(ret).not.toMatch(/fee|penalty|charge/)
  })

  it('pickup_reminder and return_reminder are distinct from each other', () => {
    expect(getCustomerEmailContent('pickup_reminder', 'en').title).not.toBe(getCustomerEmailContent('return_reminder', 'en').title)
  })
})
