import type { ReactNode } from 'react'

interface DetailRowProps {
  label: string
  value: ReactNode
}

/**
 * The shared "label left, value end" row — replacing the five
 * near-identical local `Row`/`Spec` components found independently in
 * VehicleDetailPage, CheckoutSummaryCard, BookingSummaryPage,
 * ConfirmationPage, and ManageBookingPage (Phase 8 audit, section 1.1).
 * `text-end` (not `text-right`) so the value stays on the reading-end
 * side in both English (LTR) and Arabic (RTL) automatically.
 */
export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="text-end font-medium text-brand-navy">{value ?? '—'}</span>
    </div>
  )
}
