// Phase 9D — Resend integration for the email delivery layer.
//
// Per the confirmed Phase 9A/9B decisions: `bliss.rent` is the sending
// domain, and the API key is read from an Edge Function secret
// (`RESEND_API_KEY`, set via `Deno.env.get` in index.ts — see
// send-customer-email/index.ts). This module never reads that secret
// itself; the caller passes it in as `ResendConfig`, which keeps this
// file trivially unit-testable (no Deno.env access here at all) and
// keeps the key out of every layer except the one Edge Function
// boundary that needs it — it is never sent to, or readable from,
// frontend/Vite code.
//
// `fetchImpl` is injectable (defaults to the global `fetch`) purely so
// tests can supply a fake and assert on exactly what would have been
// sent, without making a real network call or requiring a real API key.

export interface SendEmailParams {
  to: string
  subject: string
  html: string
}

export interface SendEmailResult {
  ok: boolean
  providerMessageId?: string
  errorMessage?: string
}

export interface ResendConfig {
  apiKey: string
  /** e.g. "Bliss Rent <booking@bliss.rent>" */
  fromAddress: string
  /**
   * Phase 9N — optional Reply-To address. When set, a reply lands in a
   * real monitored inbox (e.g. support@bliss.rent) instead of the
   * automated sending address. Omitted entirely from the Resend request
   * when not provided, so this is fully backward-compatible with every
   * existing call site and test.
   */
  replyTo?: string
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export async function sendViaResend(
  config: ResendConfig,
  params: SendEmailParams,
  fetchImpl: FetchLike = fetch,
): Promise<SendEmailResult> {
  if (!config.apiKey) {
    return { ok: false, errorMessage: 'RESEND_API_KEY is not configured.' }
  }

  try {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
        ...(config.replyTo ? { reply_to: [config.replyTo] } : {}),
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { ok: false, errorMessage: `Resend API error ${response.status}: ${text.slice(0, 500)}` }
    }

    const data = (await response.json().catch(() => ({}))) as { id?: string }
    return { ok: true, providerMessageId: data.id }
  } catch (err) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : String(err) }
  }
}
