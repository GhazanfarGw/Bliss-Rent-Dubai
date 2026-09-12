import { supabase } from '@/lib/supabaseClient'

export class ExtendRentalError extends Error {
  fieldErrors?: Record<string, string>
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.fieldErrors = fieldErrors
  }
}

// Note: the original standalone Extend Rental page had its own "verify
// reference + vehicle number" step here (verify_booking_for_extension()).
// That page has since been merged into Manage Booking (see
// ManageBookingPage.tsx / ExtendRentalSection.tsx) — the identity check
// is now whatever got the customer a result on that page (reference or
// vehicle plate, via lookup_booking_for_customer()), so a separate verify
// call is no longer needed here. verify_booking_for_extension() itself is
// left deployed and callable (not dropped — see this project's
// convention of not removing database objects unnecessarily) but this
// module no longer wraps it.

export interface SubmitExtendRentalRequest {
  bookingReference: string
  vehicleNumber: string
  requestedReturnDate: string
}

export interface SubmitExtendRentalResult {
  extensionId: string
  status: string
  isLate: boolean
}

/**
 * Step 2: the actual mutation, Edge-Function-mediated (same pattern as
 * checkoutApi.ts's createBooking/confirmPayment) since a guest can never
 * call the underlying submit_extension_request_public() SQL function
 * directly — it is granted to service_role only. This ONLY creates a
 * 'requested' row; it never approves, prices, or changes anything about
 * the booking itself. An admin reviews every request from the dashboard.
 */
export async function submitExtendRentalRequest(req: SubmitExtendRentalRequest): Promise<SubmitExtendRentalResult> {
  const { data, error } = await supabase.functions.invoke('submit-extension-request', {
    body: req as unknown as Record<string, unknown>,
  })

  if (error) {
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const parsed = await context.clone().json()
        throw new ExtendRentalError(parsed.message ?? 'Something went wrong.', parsed.fieldErrors)
      } catch (parseError) {
        if (parseError instanceof ExtendRentalError) throw parseError
      }
    }
    throw new ExtendRentalError(error.message)
  }

  const result = data as { extensionId: string; status: string; isLate: boolean }
  return result
}
