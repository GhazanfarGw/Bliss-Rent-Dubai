import { StatusBadge } from '@/features/shared/ui/StatusBadge'

/**
 * Phase 8 — thin alias. The tone map and rendering this component used
 * to own directly were extracted verbatim into the shared `StatusBadge`
 * (src/features/shared/ui/StatusBadge.tsx) so the identical status-chip
 * look can also serve the customer-facing side. `AdminStatusBadge` is
 * kept, under the same name and the same single `status` prop, purely
 * so every existing admin page that already imports it (Dashboard,
 * Bookings, Fleet, Payments, Extensions, Complaints) keeps working with
 * zero changes and zero behavior difference — same classes, same
 * translation keys, same fallback.
 */
export function AdminStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} />
}
