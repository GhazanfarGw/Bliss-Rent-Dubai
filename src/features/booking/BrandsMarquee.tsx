import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import { distinctBrands } from '@/lib/vehicleFilters'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * Auto-scrolling brand strip, styled to resemble the reference: centered
 * heading, then a horizontal slider of logo cards with names below.
 *
 * Brands are derived from the live fleet (`fetchAllAvailableVehicles` +
 * `distinctBrands`, the same pattern FilterBar's brand dropdown already
 * uses) — never a hardcoded or invented list. A make that doesn't have a
 * bespoke drawn mark below falls back to a plain initials badge rather
 * than a fabricated logo.
 */
export function BrandsMarquee() {
  const { t } = useTranslation()
  const [brands, setBrands] = useState<string[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAllAvailableVehicles()
      .then((vehicles) => {
        if (!cancelled) setBrands(distinctBrands(vehicles))
      })
      .catch(() => {
        if (!cancelled) setBrands([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Nothing to show yet (still loading, or genuinely no fleet data) — the
  // rest of the homepage stands fine without this section, so it simply
  // doesn't render rather than showing a placeholder or invented brands.
  if (!brands || brands.length === 0) return null

  const reducedMotion = prefersReducedMotion()
  // Marquee needs at least a few cards to loop convincingly; below that,
  // show the real brands as a plain static row instead of looping a
  // near-empty strip.
  const shouldLoop = !reducedMotion && brands.length > 3
  const items = shouldLoop ? [...brands, ...brands] : brands

  return (
    <section className="bg-brand-lavender py-8 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold-dark">Trusted by drivers</p>
          <h2 className="mt-3 text-center text-[2rem] font-black tracking-[-0.06em] text-brand-navy sm:text-[2.4rem]">
            {t('home.brands.title')}
          </h2>
        </div>

        <div className="mt-10 overflow-hidden">
          <div className="overflow-x-hidden pb-1">
            <div className={'flex min-w-max items-stretch gap-4 sm:gap-6 ' + (shouldLoop ? 'animate-marquee' : 'flex-wrap justify-center')}>
              {items.map((brand, index) => {
                const isDuplicate = shouldLoop && index >= brands.length
                return (
                  <div key={`${brand}-${index}`} aria-hidden={isDuplicate || undefined} inert={isDuplicate}>
                    <BrandCard name={brand} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function BrandCard({ name }: { name: string }) {
  return (
    <div className="flex h-[150px] w-[200px] shrink-0 flex-col items-center justify-between rounded-none border border-brand-lavender-dark bg-white px-3 py-5 shadow-none transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold/50 sm:w-[240px] sm:px-4 sm:py-6 lg:w-[260px]">
      <div className="flex h-24 w-full items-center justify-center sm:h-28">
        {renderBrandMark(name)}
      </div>
      <div className="mt-3 w-full text-center text-sm font-medium tracking-[-0.04em] text-brand-navy sm:mt-4 sm:text-base lg:text-[1.25rem]">
        {name}
      </div>
    </div>
  )
}

// Bespoke drawn marks for the makes most commonly seen in the fleet. This
// is a styling convenience, not a source of truth: any real make without
// an entry here still renders correctly via the initials-badge fallback
// rather than a fabricated logo.
function renderBrandMark(name: string) {
  const common = {
    viewBox: '0 0 200 120',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (name) {
    case 'Suzuki':
      return (
        <svg aria-label={name} role="img" className="h-16 w-32 text-[#d71920]" {...common}>
          <path d="M25 92L78 24h18L43 92H25Zm18 0 48-68h18L61 92H43Zm45 0 30-42h17L98 92h-10Z" fill="currentColor" />
        </svg>
      )
    case 'Toyota':
      return (
        <svg aria-label={name} role="img" className="h-16 w-32 text-[#1a1a1a]" {...common}>
          <circle cx="100" cy="60" r="42" stroke="currentColor" strokeWidth="4" fill="none" />
          <path d="M100 18v84M58 60h84" stroke="currentColor" strokeWidth="4" />
        </svg>
      )
    case 'Lamborghini':
      return (
        <svg aria-label={name} role="img" className="h-16 w-32 text-[#101010]" {...common}>
          <path d="M36 80h128c-8-20-18-32-30-42-12-10-25-15-42-15-20 0-35 8-46 22-9 12-14 24-10 35Z" fill="currentColor" opacity="0.92" />
          <path d="M72 66h54" stroke="#f5f5f3" strokeWidth="4" />
          <path d="M82 32c10 10 14 22 14 34" stroke="#f5f5f3" strokeWidth="4" />
        </svg>
      )
    case 'Land Rover':
      return (
        <svg aria-label={name} role="img" className="h-16 w-32 text-[#1e7d32]" {...common}>
          <path d="M28 76V44c0-6 5-11 11-11h28l33 30h26v13H28Z" fill="currentColor" />
          <path d="M76 44h30" stroke="#f5f5f3" strokeWidth="4" />
        </svg>
      )
    case 'Ferrari':
      return (
        <svg aria-label={name} role="img" className="h-16 w-32 text-[#f3d52e]" {...common}>
          <path d="M28 82V44l24-20h96l24 20v38H28Z" fill="currentColor" />
          <path d="M74 52h52" stroke="#1a1a1a" strokeWidth="4" />
          <path d="M48 82h104" stroke="#1a1a1a" strokeWidth="4" />
          <path d="M78 32l18 22 18-22" stroke="#1a1a1a" strokeWidth="4" fill="none" />
        </svg>
      )
    case 'GMC':
      return (
        <svg aria-label={name} role="img" className="h-16 w-32 text-[#cc1c2d]" {...common}>
          <path d="M28 82c0-16 12-28 28-28h88c12 0 22 10 22 22v6H28v-6ZM54 54h84" stroke="currentColor" strokeWidth="4" fill="none" />
          <path d="M60 32l40 22M96 32l40 22" stroke="currentColor" strokeWidth="4" fill="none" />
        </svg>
      )
    default:
      return (
        <div className="flex h-16 w-32 items-center justify-center rounded-none border border-brand-lavender-dark bg-white text-lg font-semibold tracking-[0.12em] text-brand-navy">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )
  }
}
