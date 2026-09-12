/**
 * Client-side form validation for the Customer/Driver checkout steps.
 * UX ONLY — this exists purely to give the customer immediate feedback
 * as they type. It is NOT the authoritative check: the create-booking
 * Edge Function independently re-validates every one of these fields
 * server-side (supabase/functions/_shared/validation.ts) before a
 * booking can be created, so nothing here needs to be (or is) trusted.
 * The two are intentionally similar but kept as separate files — see
 * that module's own comment for why they aren't shared code.
 *
 * Checkout v2 (2026-09-20): First/Last name replace one combined field,
 * customer phone is now required (it's one of only four fields Step 4
 * collects), and the driver step gained its own required phone with no
 * date-of-birth/age check at all — see types/domain.ts's DriverDraft
 * comment for the "I am the driver" toggle this validates against.
 */
import { effectiveDriverIdentity, type CustomerDraft, type DriverDraft } from '@/types/domain'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/

export type CustomerFieldErrors = Partial<Record<'firstName' | 'lastName' | 'email' | 'phone', string>>
export type DriverFieldErrors = Partial<Record<'firstName' | 'lastName' | 'phone' | 'licenseNumber' | 'licenseCountry' | 'licenseExpiry', string>>

export function validateCustomerDraft(customer: CustomerDraft): CustomerFieldErrors {
  const errors: CustomerFieldErrors = {}
  if (customer.firstName.trim().length < 1) errors.firstName = "Please enter the customer's first name."
  if (customer.lastName.trim().length < 1) errors.lastName = "Please enter the customer's last name."
  if (!EMAIL_RE.test(customer.email.trim())) errors.email = 'Please enter a valid email address.'
  if (!PHONE_RE.test(customer.phone.trim())) errors.phone = 'Please enter a valid phone or WhatsApp number.'
  return errors
}

/**
 * Validates the EFFECTIVE driver identity (customer's own info when "I
 * am the driver" is selected, the driver's own fields otherwise — see
 * types/domain.ts's effectiveDriverIdentity) alongside the driver-only
 * fields (license) that always come from the driver draft regardless of
 * the toggle.
 */
export function validateDriverDraft(customer: CustomerDraft, driver: DriverDraft, rentalEndDate: string): DriverFieldErrors {
  const errors: DriverFieldErrors = {}
  const identity = effectiveDriverIdentity(customer, driver)

  if (identity.firstName.trim().length < 1) errors.firstName = "Please enter the driver's first name."
  if (identity.lastName.trim().length < 1) errors.lastName = "Please enter the driver's last name."
  if (!PHONE_RE.test(identity.phone.trim())) errors.phone = 'Please enter a valid driver phone number.'

  if (driver.licenseNumber.trim().length < 3) errors.licenseNumber = 'Please enter a valid driving license number.'
  if (driver.licenseCountry.trim().length < 2) errors.licenseCountry = 'Please enter the country that issued the license.'

  if (!driver.licenseExpiry) {
    errors.licenseExpiry = 'Please enter the license expiry date.'
  } else {
    const expiry = new Date(driver.licenseExpiry + 'T00:00:00')
    const end = new Date(rentalEndDate + 'T00:00:00')
    if (Number.isNaN(expiry.getTime())) errors.licenseExpiry = 'Please enter a valid expiry date.'
    else if (expiry < end) errors.licenseExpiry = 'The license must still be valid through the end of the rental.'
  }

  return errors
}
