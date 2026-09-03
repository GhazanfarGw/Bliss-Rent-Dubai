import { describe, it, expect } from 'vitest'
import { getAdminOperationalEmailContent, ADMIN_OPERATIONAL_EVENT_TYPES } from './adminOperationalEmailContent.ts'

describe('getAdminOperationalEmailContent', () => {
  it('returns EN and AR content for every event type', () => {
    for (const eventType of ADMIN_OPERATIONAL_EVENT_TYPES) {
      const en = getAdminOperationalEmailContent(eventType, 'en')
      const ar = getAdminOperationalEmailContent(eventType, 'ar')
      expect(en.subject.length).toBeGreaterThan(0)
      expect(en.alertType.length).toBeGreaterThan(0)
      expect(ar.subject.length).toBeGreaterThan(0)
      expect(ar.alertType.length).toBeGreaterThan(0)
      expect(['normal', 'attention', 'urgent']).toContain(en.priority)
      expect(['normal', 'attention', 'urgent']).toContain(ar.priority)
    }
  })

  it('sets a requiredAction only for payment_failed and extension_requested — every other event is purely informational', () => {
    expect(getAdminOperationalEmailContent('admin_booking_received', 'en').requiredAction).toBeUndefined()
    expect(getAdminOperationalEmailContent('admin_booking_confirmed', 'en').requiredAction).toBeUndefined()
    expect(getAdminOperationalEmailContent('admin_booking_cancelled', 'en').requiredAction).toBeUndefined()
    expect(getAdminOperationalEmailContent('admin_payment_failed', 'en').requiredAction).toBeTruthy()
    expect(getAdminOperationalEmailContent('admin_extension_requested', 'en').requiredAction).toBeTruthy()
  })

  it('marks payment_failed and extension_requested as higher priority than the purely informational events', () => {
    expect(getAdminOperationalEmailContent('admin_payment_failed', 'en').priority).toBe('attention')
    expect(getAdminOperationalEmailContent('admin_extension_requested', 'en').priority).toBe('attention')
    expect(getAdminOperationalEmailContent('admin_booking_received', 'en').priority).toBe('normal')
    expect(getAdminOperationalEmailContent('admin_booking_confirmed', 'en').priority).toBe('normal')
    expect(getAdminOperationalEmailContent('admin_booking_cancelled', 'en').priority).toBe('normal')
  })

  it('never lets AR content silently fall back to EN text', () => {
    for (const eventType of ADMIN_OPERATIONAL_EVENT_TYPES) {
      const en = getAdminOperationalEmailContent(eventType, 'en')
      const ar = getAdminOperationalEmailContent(eventType, 'ar')
      expect(ar.subject).not.toBe(en.subject)
      expect(ar.alertType).not.toBe(en.alertType)
    }
  })

  it('lists exactly the 5 admin operational events this phase implements — no more, no less', () => {
    expect(ADMIN_OPERATIONAL_EVENT_TYPES).toEqual([
      'admin_booking_received',
      'admin_booking_confirmed',
      'admin_payment_failed',
      'admin_booking_cancelled',
      'admin_extension_requested',
    ])
  })
})
