import { supabase } from '@/lib/supabaseClient'
import i18n from '@/i18n'
import type { BookingCreationResult, CustomerDraft, DriverDraft } from '@/types/domain'

/**
 * Typed client for the two Phase 2 Edge Functions. This is the ONLY
 * place the frontend talks to create-booking / confirm-payment — both
 * are privileged, service-role-only operations (see the migration
 * comment in supabase/migrations/20260826000000_phase2_booking_checkout.sql).
 * The anon key used by `supabase` here can never call the underlying
 * database functions directly; it can only reach them through these
 * HTTP endpoints.
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

async function invoke<T>(fn: 'create-booking' | 'confirm-payment', body: object): Promise<T> {
  // Phase 9D: every create-booking/confirm-payment call carries the
  // customer's current UI language, so the booking/payment emails those
  // functions trigger render in the same language the customer is
  // actually using — a single injection point rather than every caller
  // having to remember to pass it.
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

export interface CreateBookingRequest {
  vehicleId: string
  startDate: string
  endDate: string
  pickupLocationId: string
  dropoffLocationId: string
  customer: CustomerDraft
  driver: DriverDraft
}

export function createBooking(req: CreateBookingRequest): Promise<BookingCreationResult> {
  return invoke<BookingCreationResult>('create-booking', req)
}

export interface ConfirmPaymentRequest {
  paymentId: string
  /** TEST ONLY simulated card number — see supabase/functions/_shared/testPaymentProvider.ts. */
  cardNumber: string
}

export interface ConfirmPaymentResult {
  paymentId: string
  bookingId: string
  paymentStatus: string
  bookingStatus: string
}

export function confirmPayment(req: ConfirmPaymentRequest): Promise<ConfirmPaymentResult> {
  return invoke<ConfirmPaymentResult>('confirm-payment', req)
}
