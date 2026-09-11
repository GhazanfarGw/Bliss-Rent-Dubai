import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FindMyCarHero } from '@/features/booking/FindMyCarHero'
import { BookingStatusPanel } from '@/features/booking/BookingStatusPanel'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

/**
 * Find My Car — the guest-facing, read-only "check my booking status"
 * destination, reachable from its own header link (`nav.findMyCar`) and
 * the footer, separate from Manage Booking.
 *
 * Deliberately reuses `BookingStatusPanel` byte-for-byte (the same
 * component the homepage navigator's "Booking Status" tab already uses)
 * rather than a second lookup implementation: reference-only input,
 * result reduced to exactly Client Name / Car / Car Number / Days Left —
 * never payment, pricing, or full booking details. Extending a rental or
 * finishing a pending payment stays on /manage-booking (ManageBookingPage),
 * which keeps its own full lookup, ExtendRentalSection, and
 * Continue-to-Payment flow unchanged.
 */
export function FindMyCarPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('findMyCar.title'))

  return (
    <div className="bg-[#f6f3ee]">
      <FindMyCarHero />

      <div className="mx-auto max-w-2xl px-4 pb-14 sm:px-6 lg:px-8 mt-28 md:32">
        <div className="-mt-16 overflow-hidden border border-[#ece7df] bg-white p-6 shadow-[0_30px_70px_rgba(17,20,29,0.1)] sm:-mt-20 sm:p-8 lg:p-10">
          <BookingStatusPanel />
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm font-semibold text-brand-navy underline decoration-brand-gold decoration-2 underline-offset-4">
            {t('checkout.confirmation.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
