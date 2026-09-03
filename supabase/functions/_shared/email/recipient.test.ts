import { describe, it, expect } from 'vitest'
import { resolveCustomerRecipient, MissingRecipientError } from './recipient.ts'

describe('resolveCustomerRecipient', () => {
  it('resolves name and email from the stored customer record', () => {
    expect(resolveCustomerRecipient({ full_name: 'Jane Renter', email: 'jane@example.com' })).toEqual({
      name: 'Jane Renter',
      email: 'jane@example.com',
    })
  })

  it('trims whitespace from both fields', () => {
    expect(resolveCustomerRecipient({ full_name: '  Jane Renter  ', email: '  jane@example.com  ' })).toEqual({
      name: 'Jane Renter',
      email: 'jane@example.com',
    })
  })

  it('falls back to a generic name when full_name is null', () => {
    expect(resolveCustomerRecipient({ full_name: null, email: 'jane@example.com' }).name).toBe('Customer')
  })

  it('throws MissingRecipientError when the customer record is null', () => {
    expect(() => resolveCustomerRecipient(null)).toThrow(MissingRecipientError)
  })

  it('throws MissingRecipientError when the customer record is undefined', () => {
    expect(() => resolveCustomerRecipient(undefined)).toThrow(MissingRecipientError)
  })

  it('throws MissingRecipientError when email is null', () => {
    expect(() => resolveCustomerRecipient({ full_name: 'Jane Renter', email: null })).toThrow(MissingRecipientError)
  })

  it('throws MissingRecipientError when email is an empty/whitespace string', () => {
    expect(() => resolveCustomerRecipient({ full_name: 'Jane Renter', email: '   ' })).toThrow(MissingRecipientError)
  })

  it('has no parameter for a caller-supplied override address (structural guard against trusting client input)', () => {
    // resolveCustomerRecipient.length is the function's declared arity —
    // asserting it stays at 1 catches a future change that adds a second
    // "email" argument a caller could pass client input through.
    expect(resolveCustomerRecipient.length).toBe(1)
  })
})
