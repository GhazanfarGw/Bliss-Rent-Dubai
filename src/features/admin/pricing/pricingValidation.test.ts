import { describe, it, expect } from 'vitest'
import { validatePricingDrafts } from './pricingValidation'
import type { PricingDraft } from '@/types/domain'

function draft(overrides: Partial<PricingDraft> = {}): PricingDraft {
  return { id: null, term: 'daily', listPrice: '', clientPrice: '', ...overrides }
}

describe('validatePricingDrafts', () => {
  it('allows a term to be left entirely unpriced', () => {
    expect(validatePricingDrafts([draft()])).toEqual({})
  })

  it('accepts a valid priced term where client_price <= list_price', () => {
    const errors = validatePricingDrafts([draft({ listPrice: '200', clientPrice: '150' })])
    expect(errors).toEqual({})
  })

  it('rejects a client price higher than the list price — mirrors the DB check constraint', () => {
    const errors = validatePricingDrafts([draft({ listPrice: '100', clientPrice: '150' })])
    expect(errors['daily.clientPrice']).toBeTruthy()
  })

  it('rejects a zero or negative price', () => {
    const errors = validatePricingDrafts([draft({ listPrice: '0', clientPrice: '0' })])
    expect(errors['daily.listPrice']).toBeTruthy()
    expect(errors['daily.clientPrice']).toBeTruthy()
  })

  it('rejects filling in only one side of a term', () => {
    const errors = validatePricingDrafts([draft({ listPrice: '100', clientPrice: '' })])
    expect(errors['daily.clientPrice']).toBeTruthy()
  })
})
