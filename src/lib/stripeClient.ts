import { loadStripe, type Stripe } from '@stripe/stripe-js'

/**
 * Checkout v2 (2026-09-20) — the one place Stripe.js is loaded from.
 * `loadStripe` fetches Stripe's own script and caches the resulting
 * promise, so calling this more than once (e.g. re-mounting the Payment
 * page) never reloads or re-initializes Stripe. The publishable key is
 * safe to ship to the browser — see .env.example — and is the only
 * Stripe credential that ever reaches client code.
 */
let stripePromise: Promise<Stripe | null> | null = null

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
    stripePromise = key ? loadStripe(key) : Promise.resolve(null)
  }
  return stripePromise
}
