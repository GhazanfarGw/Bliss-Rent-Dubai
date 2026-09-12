/**
 * Pure, UX-only validation for the admin Pricing ladder form — mirrors the
 * database's own `pricing_client_price_le_list_price` check constraint
 * (Phase 3 migration) so the admin sees the problem before submitting, but
 * the DB constraint remains the authoritative guard.
 */
import type { PricingDraft } from '@/types/domain'

export type PricingFieldErrors = Record<string, string>

export function validatePricingDrafts(drafts: PricingDraft[]): PricingFieldErrors {
  const errors: PricingFieldErrors = {}

  for (const draft of drafts) {
    const listFilled = draft.listPrice.trim() !== ''
    const clientFilled = draft.clientPrice.trim() !== ''
    if (!listFilled && !clientFilled) continue // leaving a term unpriced is allowed

    const list = Number(draft.listPrice)
    const client = Number(draft.clientPrice)

    if (!listFilled || Number.isNaN(list) || list <= 0) {
      errors[`${draft.term}.listPrice`] = 'Enter a list price greater than 0.'
    }
    if (!clientFilled || Number.isNaN(client) || client <= 0) {
      errors[`${draft.term}.clientPrice`] = 'Enter a client price greater than 0.'
    }
    if (listFilled && clientFilled && !Number.isNaN(list) && !Number.isNaN(client) && client > list) {
      errors[`${draft.term}.clientPrice`] = 'Client price cannot be higher than the list price.'
    }
  }

  return errors
}
