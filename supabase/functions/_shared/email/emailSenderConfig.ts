// Phase 9N — per-category sender resolution.
//
// Bliss Rent now owns three real mailboxes on the verified bliss.rent
// domain (booking@, admin@, support@). This resolves which "From"
// address and Reply-To a given email category should use, reading only
// Edge Function secrets (never touches business logic, booking data, or
// pricing). Fully backward-compatible: every new secret is optional and
// falls back to the existing single RESEND_FROM_ADDRESS behavior (and
// ultimately the same noreply@bliss.rent default) if unset, so nothing
// breaks for a deployment that hasn't added the new secrets yet.

export type EmailSenderCategory = 'customer' | 'admin'

export interface ResendSenderConfig {
  apiKey: string
  fromAddress: string
  replyTo?: string
}

const FALLBACK_CUSTOMER_FROM = 'Bliss Rent <booking@bliss.rent>'
const FALLBACK_ADMIN_FROM = 'Bliss Rent <admin@bliss.rent>'

/** Minimal shape of Deno.env, injectable so this stays unit-testable without a real Deno runtime. */
export interface EnvLike {
  get(key: string): string | undefined
}

export function getResendSenderConfig(category: EmailSenderCategory, env: EnvLike): ResendSenderConfig {
  const apiKey = env.get('RESEND_API_KEY') ?? ''
  const replyToRaw = env.get('RESEND_REPLY_TO')
  const replyTo = replyToRaw && replyToRaw.trim().length > 0 ? replyToRaw.trim() : undefined

  const legacyFrom = env.get('RESEND_FROM_ADDRESS')

  if (category === 'admin') {
    const adminFrom = env.get('RESEND_FROM_ADDRESS_ADMIN')
    const fromAddress = (adminFrom && adminFrom.trim().length > 0 ? adminFrom.trim() : undefined)
      ?? legacyFrom
      ?? FALLBACK_ADMIN_FROM
    return { apiKey, fromAddress, replyTo }
  }

  const fromAddress = legacyFrom ?? FALLBACK_CUSTOMER_FROM
  return { apiKey, fromAddress, replyTo }
}
