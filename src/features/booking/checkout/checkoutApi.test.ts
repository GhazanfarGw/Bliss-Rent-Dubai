import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CreateBookingRequest } from './checkoutApi'

const invokeMock = vi.fn()
vi.mock('@/lib/supabaseClient', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}))

// A minimal fake standing in for the real i18next instance — only the
// `.language` getter checkoutApi.ts's invoke() actually reads.
const i18nMock = { language: 'en' }
vi.mock('@/i18n', () => ({ default: i18nMock }))

const { createBooking, confirmPayment } = await import('./checkoutApi')

const CREATE_BOOKING_REQUEST: CreateBookingRequest = {
  vehicleId: 'v1',
  startDate: '2026-09-10',
  endDate: '2026-09-15',
  pickupLocationId: 'l1',
  dropoffLocationId: 'l1',
  customer: { fullName: 'Jane Renter', email: 'jane@example.com', phone: '+971500000000' },
  driver: { fullName: 'Jane Renter', dateOfBirth: '1990-01-01', licenseNumber: 'L1', licenseCountry: 'AE', licenseExpiry: '2030-01-01' },
}

/**
 * Phase 9D: checkoutApi.ts's shared invoke() helper injects the
 * customer's current UI language into every create-booking/confirm-payment
 * call, so the booking/payment emails those Edge Functions trigger render
 * in the language the customer is actually using — see
 * _shared/email/triggerCustomerBookingEmail.ts on the Edge Function side.
 */
describe('checkoutApi language injection', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null })
    i18nMock.language = 'en'
  })

  it('injects language: "en" into create-booking when the UI is in English', async () => {
    await createBooking(CREATE_BOOKING_REQUEST)
    expect(invokeMock).toHaveBeenCalledWith('create-booking', { body: expect.objectContaining({ language: 'en' }) })
  })

  it('injects language: "ar" into confirm-payment when the UI is in Arabic', async () => {
    i18nMock.language = 'ar'
    await confirmPayment({ paymentId: 'p1', cardNumber: '4111111111111111' })
    expect(invokeMock).toHaveBeenCalledWith('confirm-payment', { body: expect.objectContaining({ language: 'ar' }) })
  })

  it('normalizes any language other than exactly "ar" (e.g. a browser locale variant) to "en"', async () => {
    i18nMock.language = 'ar-EG'
    await confirmPayment({ paymentId: 'p1', cardNumber: '4111111111111111' })
    expect(invokeMock).toHaveBeenCalledWith('confirm-payment', { body: expect.objectContaining({ language: 'en' }) })
  })

  it('still forwards every original request field alongside language, without dropping any', async () => {
    await confirmPayment({ paymentId: 'p1', cardNumber: '4111111111111111' })
    expect(invokeMock).toHaveBeenCalledWith('confirm-payment', {
      body: { paymentId: 'p1', cardNumber: '4111111111111111', language: 'en' },
    })
  })
})
