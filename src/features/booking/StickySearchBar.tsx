import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchWidget } from '@/features/booking/SearchWidget'
import { prefersReducedMotion } from '@/lib/motion'
import type { SearchCriteria } from '@/types/domain'

interface StickySearchBarProps {
  onSearch: (criteria: SearchCriteria) => void
}

/**
 * Compact sticky booking bar. Appears just below the header once the user
 * scrolls past the main BookingSearchSection (#booking-section), and
 * disappears again once that section is back in view — driven by an
 * IntersectionObserver on the section itself rather than a scroll-event
 * listener, per spec. Reuses SearchWidget in compact mode, so search logic
 * (dates, locations, validation, onSearch) is never duplicated.
 */
export function StickySearchBar({ onSearch }: StickySearchBarProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(() => document.documentElement.dataset.headerVisible !== 'false')
  const reducedMotion = prefersReducedMotion()

  useEffect(() => {
    function handleHeaderVisibility(event: Event) {
      const nextVisible = (event as CustomEvent<{ visible: boolean }>).detail?.visible
      if (typeof nextVisible === 'boolean') setHeaderVisible(nextVisible)
    }

    window.addEventListener('headervisibilitychange', handleHeaderVisibility)
    return () => window.removeEventListener('headervisibilitychange', handleHeaderVisibility)
  }, [])

  useEffect(() => {
    const target = document.getElementById('booking-section')
    if (!target) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        // The bar shows once the booking section has scrolled fully above
        // the viewport, and hides again as soon as any part of it is back
        // in view (including scrolling back up past it).
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0)
      },
      { threshold: 0 },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      role="region"
      aria-label={t('home.stickyBar.label')}
      aria-hidden={!visible}
      inert={!visible ? true : undefined}
      className={
        'fixed inset-x-0 z-30 border-b border-brand-navy/10 bg-white/95 shadow-md shadow-brand-navy/10 backdrop-blur ' +
        (reducedMotion ? '' : 'transition-all duration-300 ') +
        (headerVisible ? 'top-16 ' : 'top-0 ') +
        (visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0')
      }
    >
      <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-6 lg:px-8">
        <SearchWidget onSearch={onSearch} compact layout="row" />
      </div>
    </div>
  )
}
