import { describe, it, expect } from 'vitest'
import { decideTestPaymentOutcome, testProviderReference } from './testPaymentProvider.ts'

describe('decideTestPaymentOutcome (TEST ONLY simulated gateway)', () => {
  it('approves a normal test card number', () => {
    expect(decideTestPaymentOutcome({ cardNumber: '4242 4242 4242 4242' })).toBe('paid')
  })

  it('declines a card number ending in the simulated-decline suffix 0002', () => {
    expect(decideTestPaymentOutcome({ cardNumber: '4000 0000 0000 0002' })).toBe('failed')
  })

  it('approves when no card number is supplied at all', () => {
    expect(decideTestPaymentOutcome({ cardNumber: '' })).toBe('paid')
  })

  it('ignores non-digit formatting when checking the decline suffix', () => {
    expect(decideTestPaymentOutcome({ cardNumber: '4000-0000-0000-0002' })).toBe('failed')
  })
})

describe('testProviderReference', () => {
  it('encodes the outcome in the reference string', () => {
    expect(testProviderReference('paid')).toMatch(/^TEST-PAID-/)
    expect(testProviderReference('failed')).toMatch(/^TEST-FAILED-/)
  })
})
