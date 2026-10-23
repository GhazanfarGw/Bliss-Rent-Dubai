export interface CustomerRecipientSource {
  full_name: string | null
  email: string | null
}

export interface CustomerRecipient {
  name: string
  email: string
}

export class MissingRecipientError extends Error {
  constructor(reason: string) {
    super(`Cannot resolve a customer recipient: ${reason}`)
    this.name = 'MissingRecipientError'
  }
}

export function resolveCustomerRecipient(customer: CustomerRecipientSource | null | undefined): CustomerRecipient {
  if (!customer) {
    throw new MissingRecipientError('no customer record was found for this booking')
  }
  const email = customer.email?.trim()
  if (!email) {
    throw new MissingRecipientError('the customer record has no stored email address')
  }
  const name = customer.full_name?.trim() || 'Customer'
  return { name, email }
}
