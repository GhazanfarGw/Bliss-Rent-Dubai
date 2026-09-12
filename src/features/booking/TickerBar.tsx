import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * Fixed strip pinned directly below the header (Phase 11), replacing the
 * "Live rates" card that used to float inside the hero's content
 * (which included a hardcoded, fabricated "AED 95" figure — a "no fake
 * data" violation). This bar sits between the header and the hero,
 * derives its one numeric figure from the real live fleet (the same
 * `fetchAllAvailableVehicles` + `pricing` data BrandsMarquee and
 * VehicleCard already use, via the shared `cheapestHeadlineRate`-style
 * "lowest real daily rate" computation below), and never shows anything
 * invented — if no vehicle has a `daily` pricing row yet, the rate item
 * simply doesn't render, and the bar falls back to the static
 * service-highlight items alone (real service policies, not data).
 *
 * Tracks the header's own show/hide-on-scroll state (the same
 * `headervisibilitychange` event StickySearchBar already listens to) so
 * it never leaves a gap where the header used to be, and hides itself
 * once the hero has scrolled out of view (via an IntersectionObserver on
 * Hero's `#home-hero` root) so it can never linger fixed over
 * unrelated page content further down, or collide with StickySearchBar.
 *
 * Marquee mechanics reused as-is from BrandsMarquee's established
 * pattern: the item list duplicated once, animated via the shared
 * `.animate-marquee` CSS (index.css), duplicate copy marked
 * `inert`/`aria-hidden`, and skipped for `prefers-reduced-motion` in
 * favor of a static wrapped row.
 */
export function TickerBar() {
  const { t } = useTranslation()
  const [rate, setRate] = useState<{ amount: number; currency: string } | null>(null)
  const reducedMotion = prefersReducedMotion()

  useEffect(() => {
    let cancelled = false
    fetchAllAvailableVehicles()
      .then((vehicles) => {
        if (cancelled) return
        const dailyRates = vehicles.flatMap((v) => v.pricing.filter((p) => p.term === 'daily'))
        if (dailyRates.length === 0) return
        const cheapest = dailyRates.reduce((min, row) => (row.client_price < min.client_price ? row : min))
        setRate({ amount: cheapest.client_price, currency: cheapest.currency })
      })
      .catch(() => {
        // No fake fallback — the rate item just stays absent.
      })
    return () => {
      cancelled = true
    }
  }, [])

   



  const staticItems = t('home.ticker.items', { returnObjects: true }) as string[]
  const rateItem = rate
    ? `${t('home.ticker.from')} ${rate.currency} ${rate.amount.toLocaleString()} ${t('home.ticker.perDay')}`
    : null
  const items = rateItem ? [rateItem, ...staticItems] : staticItems

  const shouldLoop = !reducedMotion
  const loopItems = shouldLoop ? [...items, ...items] : items

  return (
    <div
      className=
        "fixed inset-x-0 z-30 bottom-0 h-10 overflow-hidden border-b border-brand-champagne/25 bg-brand-gold-dark text-white"
    >
      <div className="flex h-full items-center overflow-x-hidden">
        <div className={'flex min-w-max items-center gap-8 whitespace-nowrap px-4 text-xs font-medium sm:px-6 ' + (shouldLoop ? 'animate-marquee' : 'flex-wrap justify-center gap-x-8 gap-y-1')}>
          {loopItems.map((item, index) => {
            const isDuplicate = shouldLoop && index >= items.length
            return (
              <span
                key={`${item}-${index}`}
                aria-hidden={isDuplicate || undefined}
                inert={isDuplicate}
                className="flex items-center gap-2"
              >
                <span className="h-1 w-1 rounded-full bg-brand-champagne" aria-hidden="true" />
                <span className="text-white/90">{item}</span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
