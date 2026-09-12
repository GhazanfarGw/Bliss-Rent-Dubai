import { supabase } from '@/lib/supabaseClient'
import i18n from '@/i18n'
import type { BookingCreationResult } from '@/types/domain'

/**
 * Typed client for the checkout Edge Functions. This is the ONLY place
 * the frontend talks to create-booking / create-payment-intent /
 * confirm-stripe-payment — all privileged, service-role-only operations
 * (see the migration comment in
 * supabase/migrations/20260826000000_phase2_booking_checkout.sql). The
 * anon key used by `supabase` here can never call the underlying
 * database functions directly; it can only reach them through these HTTP
 * endpoints.
 *
 * `confirm-payment` (the old TEST-ONLY provider) is intentionally left
 * out of this client as of checkout v2 (2026-09-20) — the Payment step
 * now uses Stripe exclusively — but the Edge Function itself is left
 * deployed and untouched, so nothing else that might still reference it
 * breaks.
 */
export class CheckoutApiError extends Error {
  code: string
  fieldErrors?: Record<string, string>

  constructor(body: { code?: string; message?: string; fieldErrors?: Record<string, string> }) {
    super(body.message ?? 'Something went wrong.')
    this.code = body.code ?? 'SERVER_ERROR'
    this.fieldErrors = body.fieldErrors
  }
}

async function invoke<T>(
  fn: 'create-booking' | 'create-payment-intent' | 'confirm-stripe-payment',
  body: object,
): Promise<T> {
  // Phase 9D: every call carries the customer's current UI language, so
  // the booking/payment emails those functions trigger render in the
  // same language the customer is actually using — a single injection
  // point rather than every caller having to remember to pass it.
  const requestBody: Record<string, unknown> = { ...body, language: i18n.language === 'ar' ? 'ar' : 'en' }
  const { data, error } = await supabase.functions.invoke(fn, { body: requestBody })

  if (error) {
    // supabase-js exposes the raw Response for an HTTP-level function
    // error on `.context` — that's where our jsonResponse({code, message,
    // fieldErrors}) body actually lives.
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const parsed = await context.clone().json()
        throw new CheckoutApiError(parsed)
      } catch (parseError) {
        if (parseError instanceof CheckoutApiError) throw parseError
        // fall through to the generic error below
      }
    }
    throw new CheckoutApiError({ code: 'SERVER_ERROR', message: error.message })
  }

  return data as T
}

export interface CreateBookingCustomer {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface CreateBookingDriver {
  firstName: string
  lastName: string
  phone: string
  licenseNumber: string
  licenseCountry: string
  licenseExpiry: string
}

export interface CreateBookingRequest {
  vehicleId: string
  startDate: string
  endDate: string
  pickupLocationId: string
  dropoffLocationId: string
  customer: CreateBookingCustomer
  driver: CreateBookingDriver
}

export function createBooking(req: CreateBookingRequest): Promise<BookingCreationResult> {
  return invoke<BookingCreationResult>('create-booking', req)
}

export interface CreatePaymentIntentRequest {
  paymentId: string
}

export interface CreatePaymentIntentResult {
  clientSecret: string
  paymentIntentId: string
}

/** Step 7: creates (or reuses) a Stripe PaymentIntent for a booking's pending payment. The returned client secret is what mounts Stripe's own Payment Element — the frontend never sees or stores raw card details either way. */
export function createPaymentIntent(req: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResult> {
  return invoke<CreatePaymentIntentResult>('create-payment-intent', req)
}

export interface ConfirmStripePaymentRequest {
  paymentId: string
  paymentIntentId: string
}

export interface ConfirmStripePaymentResult {
  paymentId: string
  bookingId: string
  paymentStatus: string
  bookingStatus: string
}

/** Step 7: called once Stripe's own confirmation resolves (or after a redirect-based method returns) — the server independently re-verifies the PaymentIntent with Stripe before ever marking the booking paid. */
export function confirmStripePayment(req: ConfirmStripePaymentRequest): Promise<ConfirmStripePaymentResult> {
  return invoke<ConfirmStripePaymentResult>('confirm-stripe-payment', req)
}
