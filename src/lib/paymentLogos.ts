// Real, licensed payment-network marks (same simple-icons package already
// used for car-brand logos in carBrandLogos.ts) — replaces Footer's old
// plain-text "VISA"/"Mastercard"/"Amex"/"Apple Pay" pills, which its own
// code comment flagged as placeholders "since no real gateway is
// connected yet". A real Stripe integration exists (see
// checkout/PaymentPage.tsx's Payment Element, which genuinely supports
// these networks plus Apple Pay) — that comment predates it.
import { siVisa, siMastercard, siAmericanexpress, siApplepay, siBitcoin } from 'simple-icons'

export interface PaymentLogo {
  name: string
  hex: string
  path: string
}

export const PAYMENT_LOGOS: PaymentLogo[] = [
  { name: siVisa.title, hex: siVisa.hex, path: siVisa.path },
  { name: siMastercard.title, hex: siMastercard.hex, path: siMastercard.path },
  { name: siAmericanexpress.title, hex: siAmericanexpress.hex, path: siAmericanexpress.path },
  { name: siApplepay.title, hex: siApplepay.hex, path: siApplepay.path },
  { name: siBitcoin.title, hex: siBitcoin.hex, path: siBitcoin.path },
]
