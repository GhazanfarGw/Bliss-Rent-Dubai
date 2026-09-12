import { extensionDaysBetween } from '@/lib/extensionPricing'

export interface ExtensionFormInput {
  previousReturnDate: string
  requestedReturnDate: string
  supportConfirmedBy: string
  paymentMethod: 'cash' | 'online' | ''
}

export interface ExtensionFormErrors {
  requestedReturnDate?: string
  supportConfirmedBy?: string
  paymentMethod?: string
}

export interface ExtensionFormValidationResult {
  valid: boolean
  errors: ExtensionFormErrors
  /** null only when requestedReturnDate itself is missing/unparsable. */
  extensionDays: number | null
}

/**
 * Client-side mirror of the same 1-30 day bound and required-field checks
 * request_booking_extension() enforces server-side (see the migration) —
 * gives instant feedback and avoids a wasted round trip for obviously
 * invalid input. The database function remains the real, authoritative
 * guard regardless of what this validates.
 */
export function validateExtensionForm(input: ExtensionFormInput): ExtensionFormValidationResult {
  const errors: ExtensionFormErrors = {}
  let extensionDays: number | null = null

  if (!input.supportConfirmedBy.trim()) {
    errors.supportConfirmedBy = 'Enter who confirmed this extension with the customer.'
  }

  if (!input.requestedReturnDate) {
    errors.requestedReturnDate = 'Choose the new return date.'
  } else {
    extensionDays = extensionDaysBetween(input.previousReturnDate, input.requestedReturnDate)
    if (extensionDays < 1) {
      errors.requestedReturnDate = 'The new return date must be at least 1 day after the current return date.'
    } else if (extensionDays > 30) {
      errors.requestedReturnDate = 'Extensions can be at most 30 days.'
    }
  }

  if (input.paymentMethod !== 'cash' && input.paymentMethod !== 'online') {
    errors.paymentMethod = 'Choose how the customer is paying.'
  }

  return { valid: Object.keys(errors).length === 0, errors, extensionDays }
}
