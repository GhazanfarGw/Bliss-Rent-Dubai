export type EmailSenderCategory = 'customer' | 'admin'

export interface ResendSenderConfig {
  apiKey: string
  fromAddress: string
  replyTo?: string
}

const FALLBACK_CUSTOMER_FROM = 'Bliss Rent <booking@bliss.rent>'
const FALLBACK_ADMIN_FROM = 'Bliss Rent <admin@bliss.rent>'

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
