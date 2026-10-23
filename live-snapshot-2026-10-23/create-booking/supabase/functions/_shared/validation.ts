// Server-side (authoritative) validation for the booking creation
// request. A near-identical set of checks exists on the frontend
// (src/features/booking/checkout/validation.ts) purely for immediate UX
// feedback as the customer types — that copy is NOT trusted for
// anything. This module is what actually gates whether create_booking()
// gets called at all, so a customer who bypasses the browser entirely
// (e.g. calls the Edge Function directly) still can't submit garbage.
//
// Pure and framework-free on purpose: no Deno APIs, no Supabase client —
// just data in, a result out — so it's testable under both Deno and
// Vitest without any mocking.
//
// Checkout v2 (2026-09-20): the Customer/Driver Details steps were
// redesigned to collect First Name + Last Name (not one combined field),
// a required customer phone, a driver phone, and NO driver date of
// birth (replaced by an "I am the driver / someone else" toggle on the
// frontend — the driver details step never shows a birth-date field any
// more). The 18+ age check that used to run against dateOfBirth is
// removed here in the same change — there's no birth date left to check
// it against; this is a direct, disclosed consequence of the new field
// list. fullName stays on both input types (derived by the caller from
// firstName+lastName) so create_booking()'s existing not-null/full_name
// contract is unaffected.

export interface CustomerInput {
  firstName: string
  lastName: string
  email: string
  phone: string | null
}

export interface DriverInput {
  firstName: string
  lastName: string
  phone: string | null
  licenseNumber: string
  licenseCountry: string
  licenseExpiry: string // ISO date
}

/** `create_booking()` still stores one combined `full_name` (see the checkout-v2 migration comment) — this is the single place both Edge Functions derive it from firstName+lastName, so the join logic can never drift between customer and driver. */
export function joinFullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return !Number.isNaN(new Date(value + 'T00:00:00').getTime())
}

export function validateCustomer(customer: Partial<CustomerInput>): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!customer.firstName || customer.firstName.trim().length < 1) {
    errors['customer.firstName'] = 'Please enter the customer\'s first name.'
  }
  if (!customer.lastName || customer.lastName.trim().length < 1) {
    errors['customer.lastName'] = 'Please enter the customer\'s last name.'
  }
  if (!customer.email || !EMAIL_RE.test(customer.email.trim())) {
    errors['customer.email'] = 'Please enter a valid email address.'
  }
  if (!customer.phone || !PHONE_RE.test(customer.phone.trim())) {
    errors['customer.phone'] = 'Please enter a valid phone or WhatsApp number.'
  }
  return errors
}

/**
 * `rentalStartDate` / `rentalEndDate` are required so the driver's
 * license can be checked against the actual rental period, not just
 * "today" — a license that's valid now but expires mid-rental is still a
 * real-world problem this catches. (No longer used for an age check —
 * see the module comment.)
 */
export function validateDriver(
  driver: Partial<DriverInput>,
  _rentalStartDate: string,
  rentalEndDate: string,
): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!driver.firstName || driver.firstName.trim().length < 1) {
    errors['driver.firstName'] = 'Please enter the driver\'s first name.'
  }
  if (!driver.lastName || driver.lastName.trim().length < 1) {
    errors['driver.lastName'] = 'Please enter the driver\'s last name.'
  }
  if (!driver.phone || !PHONE_RE.test(driver.phone.trim())) {
    errors['driver.phone'] = 'Please enter a valid driver phone number.'
  }
  if (!driver.licenseNumber || driver.licenseNumber.trim().length < 3) {
    errors['driver.licenseNumber'] = 'Please enter a valid driving license number.'
  }
  if (!driver.licenseCountry || driver.licenseCountry.trim().length < 2) {
    errors['driver.licenseCountry'] = 'Please enter the country that issued the license.'
  }

  if (!driver.licenseExpiry || !isValidIsoDate(driver.licenseExpiry)) {
    errors['driver.licenseExpiry'] = 'Please enter a valid license expiry date.'
  } else {
    const expiry = new Date(driver.licenseExpiry + 'T00:00:00')
    const end = new Date(rentalEndDate + 'T00:00:00')
    if (expiry < end) {
      errors['driver.licenseExpiry'] = 'The driving license must still be valid through the end of the rental.'
    }
  }

  return errors
}
