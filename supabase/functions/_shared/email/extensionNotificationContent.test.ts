import { describe, it, expect } from 'vitest'
import { getExtensionNotificationContent, EXTENSION_NOTIFICATION_TYPES } from './extensionNotificationContent.ts'

describe('getExtensionNotificationContent', () => {
  it('covers exactly the 4 notification_type values booking_notifications allows', () => {
    expect(EXTENSION_NOTIFICATION_TYPES.sort()).toEqual(
      ['vehicle_reassigned', 'extension_approved', 'extension_rejected', 'extension_conflict_pending_review'].sort(),
    )
  })

  describe('vehicle_reassigned', () => {
    const payload = {
      booking_reference: 'BLS-D300AC89',
      original_vehicle_plate: 'ABC-123',
      new_vehicle_plate: 'XYZ-999',
      start_date: '2026-09-10',
      end_date: '2026-09-15',
      reason: 'The vehicle for this booking has been updated to keep your reservation confirmed.',
    }

    it('mentions both the previous and new plate in English', () => {
      const content = getExtensionNotificationContent('vehicle_reassigned', 'en', payload)
      expect(content.message).toContain('ABC-123')
      expect(content.message).toContain('XYZ-999')
      expect(content.statusTone).toBe('info')
    })

    it('renders Arabic content for the same payload', () => {
      const content = getExtensionNotificationContent('vehicle_reassigned', 'ar', payload)
      expect(content.message).toContain('ABC-123')
      expect(content.title).toBe('تم تحديث المركبة')
    })

    it('falls back to a placeholder rather than throwing on a missing plate field', () => {
      const content = getExtensionNotificationContent('vehicle_reassigned', 'en', {})
      expect(content.message).toContain('—')
    })
  })

  describe('extension_approved', () => {
    it('reports the extension days and amount in English, singular day wording for 1 day', () => {
      const content = getExtensionNotificationContent('extension_approved', 'en', {
        requested_return_date: '2026-09-20',
        extension_days: 1,
        amount: 250,
        currency: 'AED',
        penalty_amount: null,
      })
      expect(content.message).toContain('1 extra day')
      expect(content.message).not.toContain('1 extra days')
      expect(content.message).toContain('AED 250')
      expect(content.statusTone).toBe('success')
    })

    it('uses plural day wording for more than 1 day', () => {
      const content = getExtensionNotificationContent('extension_approved', 'en', {
        requested_return_date: '2026-09-25',
        extension_days: 5,
        amount: 1250,
        currency: 'AED',
      })
      expect(content.message).toContain('5 extra days')
    })

    it('mentions the late-extension fee only when a positive penalty_amount is present', () => {
      const withPenalty = getExtensionNotificationContent('extension_approved', 'en', {
        requested_return_date: '2026-09-20',
        extension_days: 2,
        amount: 500,
        currency: 'AED',
        penalty_amount: 100,
      })
      expect(withPenalty.message).toContain('late-extension fee')
      expect(withPenalty.message).toContain('AED 100')

      const withoutPenalty = getExtensionNotificationContent('extension_approved', 'en', {
        requested_return_date: '2026-09-20',
        extension_days: 2,
        amount: 500,
        currency: 'AED',
        penalty_amount: 0,
      })
      expect(withoutPenalty.message).not.toContain('late-extension fee')
    })

    it('renders Arabic content with correct day wording', () => {
      const content = getExtensionNotificationContent('extension_approved', 'ar', {
        requested_return_date: '2026-09-20',
        extension_days: 1,
        amount: 250,
        currency: 'AED',
      })
      expect(content.message).toContain('يوم واحد')
    })
  })

  describe('extension_rejected', () => {
    it('includes the admin-entered rejection reason verbatim in English', () => {
      const content = getExtensionNotificationContent('extension_rejected', 'en', {
        reason: 'Vehicle is already booked for those dates.',
      })
      expect(content.message).toContain('Vehicle is already booked for those dates.')
      expect(content.statusTone).toBe('warning')
    })

    it('falls back to a generic reason when none is present', () => {
      const content = getExtensionNotificationContent('extension_rejected', 'en', {})
      expect(content.message).toContain('No reason was provided.')
    })

    it('renders Arabic chrome around the same (unlocalized) reason text', () => {
      const content = getExtensionNotificationContent('extension_rejected', 'ar', { reason: 'Some admin note' })
      expect(content.message).toContain('Some admin note')
      expect(content.title).toBe('تم رفض طلب التمديد')
    })
  })

  describe('extension_conflict_pending_review', () => {
    it('renders static EN/AR content regardless of payload', () => {
      const en = getExtensionNotificationContent('extension_conflict_pending_review', 'en', { note: 'anything' })
      const ar = getExtensionNotificationContent('extension_conflict_pending_review', 'ar', {})
      expect(en.statusTone).toBe('warning')
      expect(ar.statusTone).toBe('warning')
      expect(en.message.length).toBeGreaterThan(0)
      expect(ar.message.length).toBeGreaterThan(0)
    })
  })
})
