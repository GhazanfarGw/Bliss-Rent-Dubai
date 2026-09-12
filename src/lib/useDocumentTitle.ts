import { useEffect } from 'react'

const SITE_NAME = 'Bliss Rent'

/**
 * Sets the browser tab/history title for the current page. Before this,
 * every route showed the same static `index.html` title ("Bliss Rent —
 * Dubai Airport Car Rental") — real gap for bookmarking, browser history,
 * and shared links, since every open tab and every past visit looked
 * identical. Each call site passes real, already-translated copy already
 * shown on that page (a SectionHeader/PageHero title, or real vehicle
 * make/model) — nothing invented here.
 *
 * No cleanup/restore on unmount: the next page mounted by the router sets
 * its own title immediately, so there's nothing to restore to.
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Dubai Airport Car Rental`
  }, [title])
}
