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

export interface CustomerInput {
  fullName: string
  email: string
  phone: string | null
}

export interface DriverInput {
  fullName: string
  dateOfBirth: string // ISO date
  licenseNumber: string
  licenseCountry: string
  licenseExpiry: string // ISO date
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/

const MIN_DRIVER_AGE_YEARS = 18

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return !Number.isNaN(new Date(value + 'T00:00:00').getTime())
}

export function validateCustomer(customer: Partial<CustomerInput>): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!customer.fullName || customer.fullName.trim().length < 2) {
    errors['customer.fullName'] = 'Please enter the customer\'s full name.'
  }
  if (!customer.email || !EMAIL_RE.test(customer.email.trim())) {
    errors['customer.email'] = 'Please enter a valid email address.'
  }
  if (customer.phone && !PHONE_RE.test(customer.phone.trim())) {
    errors['customer.phone'] = 'Please enter a valid phone number, or leave it blank.'
  }
  return errors
}

/**
 * `rentalStartDate` / `rentalEndDate` are required so the driver's
 * license can be checked against the actual rental period, not just
 * "today" — a license that's valid now but expires mid-rental is still a
 * real-world problem this catches.
 */
export function validateDriver(
  driver: Partial<DriverInput>,
  rentalStartDate: string,
  rentalEndDate: string,
): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!driver.fullName || driver.fullName.trim().length < 2) {
    errors['driver.fullName'] = 'Please enter the driver\'s full name.'
  }
  if (!driver.licenseNumber || driver.licenseNumber.trim().length < 3) {
    errors['driver.licenseNumber'] = 'Please enter a valid driving license number.'
  }
  if (!driver.licenseCountry || driver.licenseCountry.trim().length < 2) {
    errors['driver.licenseCountry'] = 'Please enter the country that issued the license.'
  }

  if (!driver.dateOfBirth || !isValidIsoDate(driver.dateOfBirth)) {
    errors['driver.dateOfBirth'] = 'Please enter a valid date of birth.'
  } else {
    const dob = new Date(driver.dateOfBirth + 'T00:00:00')
    const start = new Date(rentalStartDate + 'T00:00:00')
    const eighteenthBirthday = new Date(dob.getFullYear() + MIN_DRIVER_AGE_YEARS, dob.getMonth(), dob.getDate())
    if (eighteenthBirthday > start) {
      errors['driver.dateOfBirth'] = 'The driver must be at least 18 years old at the start of the rental.'
    }
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
