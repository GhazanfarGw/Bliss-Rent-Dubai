import { describe, it, expect } from 'vitest'
import { validateCustomer, validateDriver } from './validation.ts'

describe('validateCustomer', () => {
  it('accepts a complete, valid customer', () => {
    expect(validateCustomer({ fullName: 'Jane Renter', email: 'jane@example.com', phone: '+971501234567' })).toEqual({})
  })

  it('accepts a valid customer with no phone (optional field)', () => {
    expect(validateCustomer({ fullName: 'Jane Renter', email: 'jane@example.com', phone: null })).toEqual({})
  })

  it('rejects a missing full name', () => {
    const errors = validateCustomer({ fullName: '', email: 'jane@example.com', phone: null })
    expect(errors['customer.fullName']).toBeDefined()
  })

  it('rejects an invalid email', () => {
    const errors = validateCustomer({ fullName: 'Jane Renter', email: 'not-an-email', phone: null })
    expect(errors['customer.email']).toBeDefined()
  })

  it('rejects an implausible phone number when one is provided', () => {
    const errors = validateCustomer({ fullName: 'Jane Renter', email: 'jane@example.com', phone: 'abc' })
    expect(errors['customer.phone']).toBeDefined()
  })
})

describe('validateDriver', () => {
  const rentalStart = '2026-09-10'
  const rentalEnd = '2026-09-15'

  const validDriver = {
    fullName: 'John Driver',
    dateOfBirth: '1990-01-01',
    licenseNumber: 'DL123456',
    licenseCountry: 'United Arab Emirates',
    licenseExpiry: '2027-01-01',
  }

  it('accepts a fully valid driver', () => {
    expect(validateDriver(validDriver, rentalStart, rentalEnd)).toEqual({})
  })

  it('rejects a driver under 18 at the start of the rental', () => {
    const errors = validateDriver({ ...validDriver, dateOfBirth: '2010-01-01' }, rentalStart, rentalEnd)
    expect(errors['driver.dateOfBirth']).toMatch(/18/)
  })

  it('accepts a driver who turns 18 exactly on the rental start date', () => {
    // Born 2008-09-10 -> turns 18 on 2026-09-10, which IS the rental start date.
    const errors = validateDriver({ ...validDriver, dateOfBirth: '2008-09-10' }, rentalStart, rentalEnd)
    expect(errors['driver.dateOfBirth']).toBeUndefined()
  })

  it('rejects a license that expires before the rental ends', () => {
    const errors = validateDriver({ ...validDriver, licenseExpiry: '2026-09-12' }, rentalStart, rentalEnd)
    expect(errors['driver.licenseExpiry']).toBeDefined()
  })

  it('accepts a license that expires exactly on the rental end date', () => {
    const errors = validateDriver({ ...validDriver, licenseExpiry: rentalEnd }, rentalStart, rentalEnd)
    expect(errors['driver.licenseExpiry']).toBeUndefined()
  })

  it('rejects a missing license number', () => {
    const errors = validateDriver({ ...validDriver, licenseNumber: '' }, rentalStart, rentalEnd)
    expect(errors['driver.licenseNumber']).toBeDefined()
  })
})
