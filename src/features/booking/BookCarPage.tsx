import { Navigate, useLocation } from 'react-router-dom'

/**
 * Fleet (SearchResultsPage, at /search) is the single search/booking entry
 * point for the whole site now — see its own handling of `?mode=book` for
 * how a plain "Book Now" click opens its search dialog directly. /book used
 * to be a second, standalone copy of the same SearchWidget form: a separate
 * page a visitor filled in before being sent to Fleet, where they filled in
 * the same fields again. It's kept only as a redirect so old bookmarks,
 * shared links, and search-engine results still resolve to something real
 * instead of a dead route — never a second form.
 *
 * Any search criteria already in the URL (e.g. a hand-built `/book?start=
 * ...&end=...` link) are forwarded to Fleet as-is; with none, it opens
 * Fleet's own search dialog (`/search?mode=book`), matching what visiting
 * /book used to start.
 */
export function BookCarPage() {
  const location = useLocation()
  const target = location.search ? `/search${location.search}` : '/search?mode=book'
  return <Navigate to={target} replace />
}
