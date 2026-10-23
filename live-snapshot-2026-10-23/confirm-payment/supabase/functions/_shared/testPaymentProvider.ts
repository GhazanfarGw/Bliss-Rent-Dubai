// =============================================================================
// TEST ONLY — simulated payment provider.
//
// The business has not selected a real payment gateway yet (Phase 2
// scope explicitly says not to invent/permanently integrate one). This
// module stands in for that integration so the checkout → payment →
// confirmation flow can be built, exercised, and demoed end-to-end.
//
// THIS IS NOT A REAL PAYMENT INTEGRATION. No money moves, no card data is
// validated or stored, and the "card number" is only ever used to decide
// a simulated outcome using a well-known test-card convention (mirroring
// how real sandboxes like Stripe's test mode work): a card ending in
// 0002 is a simulated decline, anything else simulates success.
//
// The decision is made HERE, server-side, inside the confirm-payment
// Edge Function — never by trusting a "did it succeed?" flag sent by the
// browser. When a real gateway is integrated later, this file is the
// only thing that needs replacing: swap `decideTestPaymentOutcome` for a
// real API call / webhook-signature verification behind the same
// `PaymentOutcome` return shape, and nothing else in the booking flow
// needs to change.
// =============================================================================

export type PaymentOutcome = 'paid' | 'failed'

const SIMULATED_DECLINE_SUFFIX = '0002'

export interface TestPaymentInput {
  /** Free-text "card number" — TEST ONLY, never a real PAN. Digits/spaces only. */
  cardNumber: string
}

export function decideTestPaymentOutcome(input: TestPaymentInput): PaymentOutcome {
  const digitsOnly = (input.cardNumber ?? '').replace(/\D/g, '')
  if (digitsOnly.endsWith(SIMULATED_DECLINE_SUFFIX)) {
    return 'failed'
  }
  return 'paid'
}

export function testProviderReference(outcome: PaymentOutcome): string {
  const suffix = Math.random().toString(36).slice(2, 10).toUpperCase()
  return `TEST-${outcome.toUpperCase()}-${suffix}`
}
