import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * The shared "booking result" card shell — a navy icon tile over a titled
 * section, used everywhere a lookup result is broken into grouped facts
 * (Vehicle / Trip & Payment / Actions on the merged Manage Booking page).
 * Originally built for the homepage's Manage Booking tab
 * (ManageBookingVerifyPanel) and lifted out here so ManageBookingPage's
 * standalone /manage-booking result renders the exact same card language
 * instead of two independently-styled lookalikes.
 *
 * `title` is optional: the Actions card on Manage Booking omits it when
 * wrapping ExtendRentalSection, which renders its own heading already.
 */
export function ResultCard({
  icon: Icon,
  title,
  emphasis = false,
  children,
}: {
  icon: LucideIcon
  title?: string
  emphasis?: boolean
  children: ReactNode
}) {
  return (
    <section className={'min-w-0 rounded-none bg-white p-5 sm:p-6 ' + (emphasis ? 'border border-brand-gold border-t-4 shadow-sm' : 'border border-brand-navy/10 shadow-sm')}>
      {title && (
        <div className="mb-5 flex items-center gap-3 border-b border-brand-navy/10 pb-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center bg-brand-navy text-white">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h3 className="text-sm font-bold uppercase tracking-[0.13em] text-brand-navy">{title}</h3>
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function ResultRow({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-3 text-sm">
      <span className="leading-5 text-text-muted">{label}</span>
      <span className={`break-words text-end leading-5 text-brand-navy ${strong ? 'text-base font-bold' : 'font-medium'}`}>
        {typeof value === 'string' ? value.replace(/_/g, ' ') : value}
      </span>
    </div>
  )
}
