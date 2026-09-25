import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { fetchLocations } from '@/features/booking/api'
import { sortByOrder } from '@/features/booking/locationDisplay'
import { UaeFlag } from '@/features/shared/UaeFlag'
import type { Location } from '@/types/domain'

interface CityEntry {
  city: string
  pointCount: number
}

function summarizeCities(locations: Location[]): CityEntry[] {
  const cities = Array.from(new Set(locations.map((l) => l.city))).sort((a, b) => sortByOrder(a, b, 'Dubai'))
  return cities.map((city) => ({ city, pointCount: locations.filter((l) => l.city === city).length }))
}

/**
 * Header city selector — a UAE-flag + "Cities" + chevron trigger opening a plain list of every
 * real, currently-live city from the same `fetchLocations()` query the
 * search widget and Locations page already use (never a hardcoded
 * list). Styled after a compact city-switcher pattern (flag + label +
 * chevron trigger, simple dropdown list) rather than a wide mega-menu.
 * This app has no per-city "selected city" browsing context to switch
 * into (search isn't scoped by city), so the trigger deliberately says
 * "Cities" rather than naming one city as if it were already selected —
 * each row here is a real link straight to the Locations page, not a
 * filter this doesn't actually have. Renders nothing until the fetch
 * resolves and nothing at all on failure or when there are no live
 * cities yet — same discipline as every other live section sitewide.
 */
export function CitiesMenu({ tone }: { tone: 'light' | 'dark' }) {
  const { t } = useTranslation()
  const routeLocation = useLocation()
  const [cities, setCities] = useState<CityEntry[] | null>(null)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetchLocations()
      .then((data) => {
        if (!cancelled) setCities(summarizeCities(data))
      })
      .catch(() => {
        if (!cancelled) setCities([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [routeLocation.pathname])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (!cities || cities.length === 0) return null

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          'flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors ' +
          (tone === 'light'
            ? 'border-white/35 text-white/90 hover:text-white'
            : 'border-[#e6e1d9] text-[#4a5360] hover:text-brand-gold')
        }
      >
        <UaeFlag className="h-3.5 w-auto shrink-0" />
        {t('nav.cities')}
        <ChevronDown className={'h-3.5 w-3.5 shrink-0 transition-transform duration-200' + (open ? ' rotate-180' : '')} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('nav.cities')}
          className="absolute inset-e-0 top-full z-50 mt-2 w-56 border border-[#ece7df] bg-white py-1.5 shadow-[0_20px_38px_rgba(18,20,23,0.14)]"
        >
          {cities.map(({ city, pointCount }) => (
            <Link
              key={city}
              to="/locations"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-2 px-4 py-2.5 text-start transition-colors hover:bg-surface-warm"
            >
              <span className="flex items-center gap-2.5 text-sm font-medium text-brand-navy">
                <UaeFlag className="h-3.5 w-auto shrink-0" />
                {city}
              </span>
              <span className="shrink-0 text-xs text-text-muted">{t('pages.locations.pointCount', { count: pointCount })}</span>
            </Link>
          ))}
          <div className="mt-1 border-t border-brand-navy/10 pt-1.5">
            <Link
              to="/locations"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-center text-xs font-semibold text-brand-gold-dark hover:underline"
            >
              {t('nav.allLocations')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
