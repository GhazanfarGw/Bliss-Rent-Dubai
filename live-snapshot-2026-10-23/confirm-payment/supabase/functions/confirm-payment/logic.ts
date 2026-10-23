// Pure, framework-free request handler for the confirm-payment Edge
// Function. See create-booking/logic.ts for the same split rationale.
import { decideTestPaymentOutcome, testProviderReference } from '../_shared/testPaymentProvider.ts'
import { ApiError, mapDatabaseError } from '../_shared/errors.ts'

export interface ConfirmPaymentRequestBody {
  paymentId?: string
  /** TEST ONLY simulated card number — see _shared/testPaymentProvider.ts. Never a real PAN. */
  cardNumber?: string
}

export interface ConfirmPaymentResult {
  paymentId: string
  bookingId: string
  paymentStatus: string
  bookingStatus: string
}

export interface SupabaseLike {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }>
}

export async function handleConfirmPayment(
  body: ConfirmPaymentRequestBody,
  supabase: SupabaseLike,
): Promise<ConfirmPaymentResult> {
  if (!body.paymentId || typeof body.paymentId !== 'string') {
    throw new ApiError('VALIDATION_ERROR', 'paymentId is required.', 422, { paymentId: 'paymentId is required.' })
  }

  // TEST ONLY: the outcome is decided here, server-side, from a
  // simulated test-card convention — never by trusting a "succeeded"
  // flag sent by the browser. See _shared/testPaymentProvider.ts.
  const outcome = decideTestPaymentOutcome({ cardNumber: body.cardNumber ?? '' })
  const providerReference = testProviderReference(outcome)

  const { data, error } = await supabase.rpc('confirm_payment', {
    p_payment_id: body.paymentId,
    p_outcome: outcome,
    p_provider_reference: providerReference,
  })

  if (error) throw mapDatabaseError(error)
  const row = data?.[0]
  if (!row) throw new ApiError('SERVER_ERROR', 'Payment confirmation did not return a result.', 500)

  return {
    paymentId: row.payment_id as string,
    bookingId: row.booking_id as string,
    paymentStatus: row.payment_status as string,
    bookingStatus: row.booking_status as string,
  }
}
