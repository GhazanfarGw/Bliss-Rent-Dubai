import { SearchWidget } from '@/features/booking/SearchWidget'
import type { SearchCriteria } from '@/types/domain'

interface BookingSearchSectionProps {
  onSearch: (criteria: SearchCriteria) => void
}

/**
 * The booking/search card directly below the hero. This is a visual wrapper
 * only — all search logic (date validation, location loading, submit
 * handling) stays in SearchWidget, reused unchanged. The `id` here is what
 * the hero CTA scrolls to and what StickySearchBar's IntersectionObserver
 * watches to know when it's scrolled out of view.
 *
 * Just the search form — the old "What would you like to do?" heading and
 * Search Cars / Manage Booking tab row were removed at the owner's request
 * to keep the card short and simple. Manage Booking is still one click away
 * in the header nav (/manage-booking).
 */
export function BookingSearchSection({ onSearch }: BookingSearchSectionProps) {
  return (
    <section
      id="booking-section"
      className="relative z-20 -mt-12 scroll-mt-20 pb-6 sm:-mt-16 sm:pb-8"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Plain white rounded card, after the Qatar Airways booking box. */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_24px_60px_rgba(7,10,26,0.14)] sm:p-6">
          <SearchWidget layout="row" compact onSearch={onSearch} />
        </div>
      </div>
    </section>
  )
}
