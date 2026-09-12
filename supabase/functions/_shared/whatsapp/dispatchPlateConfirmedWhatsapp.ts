// Phase 14 — WhatsApp dispatch for the `plate_confirmed` notification.
//
// Decision 2 (owner-approved, 2026-09-07): "Do not make the new
// plate-confirmation workflow Email-only as the final business flow...
// If the WhatsApp provider/integration is not yet configured, keep the
// notification event/queue fully prepared and clearly report the exact
// remaining provider/configuration requirement rather than inventing
// credentials or a provider."
//
// A repo-wide audit (grep for whatsapp/twilio/meta-cloud/wa.me, plus the
// Phase 7/Phase 9 migration and pre-implementation-report comments) found
// NO WhatsApp send integration anywhere in this codebase — only a static
// wa.me/971500000000 link in contactLinks.ts (a support-contact link, not
// a send API). So this file deliberately does NOT call any real vendor —
// it only recognizes whether one has been configured (via the
// WHATSAPP_PROVIDER env var, checked but never assumed to be set) and, if
// not, safely and idempotently transitions the row to 'not_configured' so
// the gap is visible in booking_notifications rather than the row being
// silently stuck at 'pending_delivery' forever.
//
// When a real provider IS wired up in a future phase, this is the single
// place that gains the actual HTTP call — no other file in this codebase
// needs to change.

export interface WhatsappNotificationSource {
  from(table: 'booking_notifications'): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          select(columns: string): {
            maybeSingle(): Promise<{ data: { id: string } | null; error: { message: string } | null }>
          }
        }
      }
    }
  }
}

export type PlateConfirmedWhatsappOutcome =
  | { status: 'not_configured' }
  | { status: 'already_resolved' }
  | { status: 'sent'; providerMessageId?: string }
  | { status: 'failed'; errorMessage: string }

export interface DispatchPlateConfirmedWhatsappDeps {
  dataSource: WhatsappNotificationSource
  /** process.env-equivalent lookup — Deno.env.get in the real Edge Function, a plain object in tests. */
  getEnv(name: string): string | undefined
}

/**
 * Idempotent compare-and-swap: only ever moves a row OUT of
 * 'pending_delivery', and only the one row matching notificationId — never
 * touches a row some other dispatch attempt already resolved (to 'sent',
 * 'failed', or 'not_configured'), so calling this more than once for the
 * same notification is always safe.
 */
export async function dispatchPlateConfirmedWhatsapp(
  deps: DispatchPlateConfirmedWhatsappDeps,
  notificationId: string,
): Promise<PlateConfirmedWhatsappOutcome> {
  const provider = deps.getEnv('WHATSAPP_PROVIDER')?.trim()

  if (!provider) {
    const { data, error } = await deps.dataSource
      .from('booking_notifications')
      .update({ whatsapp_status: 'not_configured', whatsapp_dispatched_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('whatsapp_status', 'pending_delivery')
      .select('id')
      .maybeSingle()

    if (error) return { status: 'failed', errorMessage: error.message }
    if (!data) return { status: 'already_resolved' }
    return { status: 'not_configured' }
  }

  // No real provider is invented here even if WHATSAPP_PROVIDER is set to
  // something unrecognized — per the owner's explicit instruction not to
  // silently introduce Twilio/Meta Cloud API/another vendor. A future
  // phase that actually wires up a provider replaces this branch with the
  // real HTTP call and its own success/failure handling.
  return { status: 'failed', errorMessage: `WHATSAPP_PROVIDER="${provider}" is not a recognized/implemented provider yet.` }
}
