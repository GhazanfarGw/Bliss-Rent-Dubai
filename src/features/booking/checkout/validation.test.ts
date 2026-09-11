import { describe, it, expect } from 'vitest'
import { validateCustomerDraft, validateDriverDraft } from './validation'
import { EMPTY_CUSTOMER_DRAFT, EMPTY_DRIVER_DRAFT, type CustomerDraft } from '@/types/domain'

const validCustomer: CustomerDraft = {
  firstName: 'Jane',
  lastName: 'Renter',
  email: 'jane@example.com',
  phone: '+971501234567',
}

describe('validateCustomerDraft', () => {
  it('accepts a fully valid customer', () => {
    expect(validateCustomerDraft(validCustomer)).toEqual({})
  })

  it('flags every field on a totally empty draft, including phone which is now required', () => {
    const errors = validateCustomerDraft(EMPTY_CUSTOMER_DRAFT)
    expect(errors.firstName).toBeDefined()
    expect(errors.lastName).toBeDefined()
    expect(errors.email).toBeDefined()
    expect(errors.phone).toBeDefined()
  })

  it('rejects a malformed email', () => {
    expect(validateCustomerDraft({ ...validCustomer, email: 'nope' }).email).toBeDefined()
  })

  it('rejects a malformed phone number', () => {
    expect(validateCustomerDraft({ ...validCustomer, phone: 'nope' }).phone).toBeDefined()
  })
})

describe('validateDriverDraft', () => {
  const end = '2026-09-15'
  const validDriver = {
    isSameAsCustomer: false,
    firstName: 'John',
    lastName: 'Driver',
    phone: '+971509876543',
    licenseNumber: 'DL123456',
    licenseCountry: 'UAE',
    licenseExpiry: '2027-01-01',
  }

  it('accepts a fully valid "someone else" driver', () => {
    expect(validateDriverDraft(validCustomer, validDriver, end)).toEqual({})
  })

  it('flags every field on a totally empty "someone else" driver', () => {
    const errors = validateDriverDraft(validCustomer, { ...EMPTY_DRIVER_DRAFT, isSameAsCustomer: false }, end)
    expect(errors.firstName).toBeDefined()
    expect(errors.lastName).toBeDefined()
    expect(errors.phone).toBeDefined()
    expect(errors.licenseNumber).toBeDefined()
    expect(errors.licenseCountry).toBeDefined()
    expect(errors.licenseExpiry).toBeDefined()
  })

  it('when "I am the driver" is selected, validates the CUSTOMER\'s name/phone instead of the (blank) driver fields', () => {
    const sameAsCustomerDriver = { ...validDriver, isSameAsCustomer: true, firstName: '', lastName: '', phone: '' }
    const errors = validateDriverDraft(validCustomer, sameAsCustomerDriver, end)
    expect(errors.firstName).toBeUndefined()
    expect(errors.lastName).toBeUndefined()
    expect(errors.phone).toBeUndefined()
  })

  it('still requires license fields even when "I am the driver" is selected', () => {
    const sameAsCustomerDriver = { ...EMPTY_DRIVER_DRAFT, isSameAsCustomer: true }
    const errors = validateDriverDraft(validCustomer, sameAsCustomerDriver, end)
    expect(errors.licenseNumber).toBeDefined()
    expect(errors.licenseCountry).toBeDefined()
    expect(errors.licenseExpiry).toBeDefined()
  })

  it('rejects a license expiring before the rental ends', () => {
    expect(validateDriverDraft(validCustomer, { ...validDriver, licenseExpiry: '2026-09-11' }, end).licenseExpiry).toBeDefined()
  })

  it('rejects an invalid driver phone number', () => {
    expect(validateDriverDraft(validCustomer, { ...validDriver, phone: 'nope' }, end).phone).toBeDefined()
  })
})
