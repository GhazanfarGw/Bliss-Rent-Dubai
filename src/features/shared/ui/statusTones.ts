/**
 * Phase 11: migrated off stock Tailwind colors onto the semantic Bliss Rent
 * design tokens (no tone-to-status mapping changed, only the underlying
 * classes) so every status badge in the app draws from the same palette.
 */
export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger'

export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-surface-muted text-text-muted',
  info: 'bg-brand-lavender text-brand-navy',
  warning: 'bg-warning-bg text-warning',
  success: 'bg-success-bg text-success',
  danger: 'bg-error-bg text-error',
}

export const STATUS_VALUE_TONE: Record<string, StatusTone> = {
  // bookings
  pending_payment: 'warning',
  confirmed: 'info',
  active: 'success',
  completed: 'neutral',
  cancelled: 'danger',
  // payments
  pending: 'warning',
  paid: 'success',
  failed: 'danger',
  refunded: 'neutral',
  // complaints
  open: 'danger',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
  // extensions
  approved: 'success',
  rejected: 'danger',
  requested: 'info',
  conflict_unresolved: 'warning',
  // vehicles / operational
  available: 'success',
  reserved: 'info',
  rented: 'warning',
  maintenance: 'danger',
  unavailable: 'neutral',
  retired: 'neutral',
  // email_log delivery status (Phase 9J) — 'failed' above is already the
  // right tone (danger) and is shared as-is; 'queued' deliberately falls
  // through to the 'neutral' default rather than being listed here.
  sent: 'info',
  delivered: 'success',
  bounced: 'danger',
}
