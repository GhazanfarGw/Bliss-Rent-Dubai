import { getBrandLogo } from '@/lib/carBrandLogos'

/**
 * A make's real, licensed brand mark (see `carBrandLogos`) at its official
 * color. A make the library doesn't carry falls back to a plain initials
 * badge rather than a fabricated logo. Shared by the homepage brand strip
 * and the About page's fleet section.
 */
export function BrandMark({ name }: { name: string }) {
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
