import { describe, it, expect } from 'vitest'
import { buildOncePerBookingKey, buildRepeatableEventKey, buildComplaintEventKey } from './idempotencyKey.ts'

describe('buildOncePerBookingKey', () => {
  it('builds a stable key from booking id + event type', () => {
    expect(buildOncePerBookingKey('b-1', 'booking_confirmed')).toBe('booking:b-1:booking_confirmed')
  })

  it('is deterministic — the same inputs always produce the same key (the whole point of idempotency)', () => {
    const a = buildOncePerBookingKey('b-1', 'booking_confirmed')
    const b = buildOncePerBookingKey('b-1', 'booking_confirmed')
    expect(a).toBe(b)
  })

  it('produces different keys for different events on the same booking', () => {
    expect(buildOncePerBookingKey('b-1', 'booking_confirmed')).not.toBe(buildOncePerBookingKey('b-1', 'payment_received'))
  })

  it('produces different keys for the same event on different bookings', () => {
    expect(buildOncePerBookingKey('b-1', 'booking_confirmed')).not.toBe(buildOncePerBookingKey('b-2', 'booking_confirmed'))
  })

  it('throws on an empty booking id rather than silently building a malformed key', () => {
    expect(() => buildOncePerBookingKey('', 'booking_confirmed')).toThrow()
  })

  it('throws on an empty event type', () => {
    expect(() => buildOncePerBookingKey('b-1', '')).toThrow()
  })
})

describe('buildRepeatableEventKey', () => {
  it('folds in the triggering row id so each occurrence gets its own key', () => {
    const first = buildRepeatableEventKey('b-1', 'status_changed', 'history-row-1')
    const second = buildRepeatableEventKey('b-1', 'status_changed', 'history-row-2')
    expect(first).not.toBe(second)
  })

  it('is still idempotent for a retry of the SAME occurrence', () => {
    const a = buildRepeatableEventKey('b-1', 'status_changed', 'history-row-1')
    const b = buildRepeatableEventKey('b-1', 'status_changed', 'history-row-1')
    expect(a).toBe(b)
  })

  it('includes booking id, event type, and row id in the key', () => {
    expect(buildRepeatableEventKey('b-1', 'status_changed', 'row-9')).toBe('booking:b-1:status_changed:row-9')
  })

  it('throws when the triggering row id is missing', () => {
    expect(() => buildRepeatableEventKey('b-1', 'status_changed', '')).toThrow()
  })
})

describe('buildComplaintEventKey', () => {
  it('builds a complaint-prefixed key distinct from a booking key with the same ids', () => {
    const complaintKey = buildComplaintEventKey('c-1', 'admin_complaint_received', 'admin-1')
    expect(complaintKey).toBe('complaint:c-1:admin_complaint_received:admin-1')
    expect(complaintKey).not.toBe(buildRepeatableEventKey('c-1', 'admin_complaint_received', 'admin-1'))
  })

  it('gives two different admins distinct keys for the same complaint', () => {
    const a = buildComplaintEventKey('c-1', 'admin_complaint_received', 'admin-1')
    const b = buildComplaintEventKey('c-1', 'admin_complaint_received', 'admin-2')
    expect(a).not.toBe(b)
  })

  it('is idempotent for a retry of the same complaint + admin', () => {
    const a = buildComplaintEventKey('c-1', 'admin_complaint_received', 'admin-1')
    const b = buildComplaintEventKey('c-1', 'admin_complaint_received', 'admin-1')
    expect(a).toBe(b)
  })

  it('throws on an empty complaint id, event type, or discriminator', () => {
    expect(() => buildComplaintEventKey('', 'admin_complaint_received', 'admin-1')).toThrow()
    expect(() => buildComplaintEventKey('c-1', '', 'admin-1')).toThrow()
    expect(() => buildComplaintEventKey('c-1', 'admin_complaint_received', '')).toThrow()
  })
})
