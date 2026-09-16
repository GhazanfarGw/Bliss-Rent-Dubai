import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import { distinctBrands } from '@/lib/vehicleFilters'
import { prefersReducedMotion } from '@/lib/motion'
import { getBrandLogo } from '@/lib/carBrandLogos'

/**
 * Auto-scrolling brand strip, styled to resemble the reference: centered
 * heading, then a horizontal slider of logo cards with names below.
 *
 * Brands are derived from the live fleet (`fetchAllAvailableVehicles` +
 * `distinctBrands`, the same pattern FilterBar's brand dropdown already
 * uses) — never a hardcoded or invented list. A make's real logo comes
 * from `carBrandLogos` (backed by simple-icons, a licensed library of
 * official brand marks); a make it doesn't carry falls back to a plain
 * initials badge rather than a fabricated logo.
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
    <section className="py-8 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold-dark">
            <span className="relative flex h-1.5 w-1.5">
              {!reducedMotion && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-champagne opacity-75" />
              )}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-gold" />
            </span>
            Trusted by drivers
          </p>
          <h2 className="font-hero-serif mt-3 text-center text-3xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-4xl">
            {t('home.brands.title')}
          </h2>
        </div>

        <div className={'mt-10 overflow-hidden ' + (shouldLoop ? '[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]' : '')}>
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
    <div className="group flex h-full w-[100px] shrink-0 flex-col items-center justify-between rounded-none border border-transparent py-2 shadow-none transition-all duration-300 hover:-translate-y-1]">
      {/* Monochrome at rest, real brand color on hover — "silver" logo
          strip per the redesign brief. grayscale/opacity apply to
          whichever mark renders (the real simple-icons SVG, or the
          initials-badge fallback — see renderBrandMark). */}
      <div className="flex h-24 w-full items-center justify-center opacity-60 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0 sm:h-24">
        {renderBrandMark(name)}
      </div>
      <p className="mt-2 text-center text-xs font-semibold tracking-[0.12em] text-brand-navy">{name}</p>

    </div>
  )
}

// Real, licensed brand marks (see `carBrandLogos`) rendered at their
// official color. A make the library doesn't carry falls back to a plain
// initials badge rather than a fabricated logo.
function renderBrandMark(name: string) {
  const logo = getBrandLogo(name)
  if (logo) {
    if (logo.image) {
      return <img src={logo.image} alt={name} className="h-16 w-16 object-contain sm:h-20 sm:w-20" />
    }

    const layers = (
      <>
        <path d={logo.path} fill={`#${logo.hex}`} fillRule={logo.fillRule} />
        {logo.extraPaths?.map((layer, i) => (
          <path
            key={i}
            d={layer.d}
            fill={layer.fill ? `#${layer.fill}` : 'none'}
            stroke={layer.stroke ? `#${layer.stroke}` : undefined}
            strokeWidth={layer.strokeWidth}
            fillRule={layer.fillRule}
          />
        ))}
      </>
    )

    return (
      <svg aria-label={name} role="img" viewBox={logo.viewBox ?? '0 0 24 24'} className="h-16 w-16 sm:h-20 sm:w-20">
        {logo.transform ? <g transform={logo.transform}>{layers}</g> : layers}
      </svg>
    )
  }

  return (
    <div className="flex h-16 w-32 items-center justify-center rounded-none border border-brand-lavender-dark text-lg font-semibold tracking-[0.12em] text-brand-navy">
      {name.slice(0, 2).toUpperCase()}

    </div>
  )
}
