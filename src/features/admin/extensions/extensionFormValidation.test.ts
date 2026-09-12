import { describe, it, expect } from 'vitest'
import { validateExtensionForm } from './extensionFormValidation'

const BASE = {
  previousReturnDate: '2026-09-02',
  supportConfirmedBy: 'Aisha (support)',
  paymentMethod: 'cash' as const,
}

describe('validateExtensionForm', () => {
  it('accepts a +1 day extension', () => {
    const result = validateExtensionForm({ ...BASE, requestedReturnDate: '2026-09-03' })
    expect(result.valid).toBe(true)
    expect(result.extensionDays).toBe(1)
  })

  it('accepts a +30 day extension', () => {
    const result = validateExtensionForm({ ...BASE, requestedReturnDate: '2026-10-02' })
    expect(result.valid).toBe(true)
    expect(result.extensionDays).toBe(30)
  })

  it('rejects 0 days (same as the current return date)', () => {
    const result = validateExtensionForm({ ...BASE, requestedReturnDate: '2026-09-02' })
    expect(result.valid).toBe(false)
    expect(result.errors.requestedReturnDate).toMatch(/at least 1 day/)
  })

  it('rejects 31 days', () => {
    const result = validateExtensionForm({ ...BASE, requestedReturnDate: '2026-10-03' })
    expect(result.valid).toBe(false)
    expect(result.errors.requestedReturnDate).toMatch(/at most 30 days/)
  })

  it('requires who confirmed the request with the customer', () => {
    const result = validateExtensionForm({ ...BASE, supportConfirmedBy: '  ', requestedReturnDate: '2026-09-05' })
    expect(result.valid).toBe(false)
    expect(result.errors.supportConfirmedBy).toBeDefined()
  })

  it('requires a payment method', () => {
    const result = validateExtensionForm({ ...BASE, paymentMethod: '', requestedReturnDate: '2026-09-05' })
    expect(result.valid).toBe(false)
    expect(result.errors.paymentMethod).toBeDefined()
  })

  it('requires a new return date', () => {
    const result = validateExtensionForm({ ...BASE, requestedReturnDate: '' })
    expect(result.valid).toBe(false)
    expect(result.extensionDays).toBeNull()
  })
})
