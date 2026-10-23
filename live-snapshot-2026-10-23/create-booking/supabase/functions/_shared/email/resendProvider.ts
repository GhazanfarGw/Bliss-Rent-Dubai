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
  fromAddress: string
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
