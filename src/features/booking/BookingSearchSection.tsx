import { BookingNavigator } from '@/features/booking/BookingNavigator'
import type { SearchCriteria } from '@/types/domain'

interface BookingSearchSectionProps {
  onSearch: (criteria: SearchCriteria) => void
}

/**
 * The large, premium booking/search section directly below the hero. This
 * is a visual wrapper only — all search logic (date validation, location
 * loading, submit handling) stays in SearchWidget inside BookingNavigator,
 * reused unchanged. The `id` here is what the hero CTA scrolls to and what
 * StickySearchBar's IntersectionObserver watches to know when it's
 * scrolled out of view.
 *
 * Phase 11 correction: the card's heading/subtitle and SearchWidget used
 * to render unconditionally here, below a small always-visible tab row.
 * Both now live inside BookingNavigator itself, which swaps in the
 * Manage Booking / Booking Status / Contact panels in their place — this
 * section is left as the plain premium card frame (rounded corners,
 * border, shadow) around whichever panel is active.
 */
export function BookingSearchSection({ onSearch }: BookingSearchSectionProps) {
  return (
    <section
      id="booking-section"
      className="relative z-20 -mt-12 scroll-mt-20 pb-6 sm:-mt-16 sm:pb-8"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-[0_30px_80px_rgba(7,10,26,0.16)]">
          <BookingNavigator onSearch={onSearch} />
        </div>
      </div>
    </section>
  )
}
