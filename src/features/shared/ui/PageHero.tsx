import { ShieldCheck } from 'lucide-react'

export interface PageHeroProps {
  imageSrc: string
  imageAlt: string
  badge: string
  title: string
  subtitle: string
}

/**
 * A page-scale hero banner shared by secondary pages that deserve more
 * than the plain color-strip banner content pages use (About, Car
 * Types, …) — a real photo, a short badge, and a headline/subtitle pair.
 * Distinct from the homepage's full-bleed Hero (which overlays a
 * transparent header and negates the layout's top padding): every page
 * using this one keeps the normal solid header above it, since NavBar's
 * transparent-over-hero treatment is scoped to the homepage only.
 *
 * Purely presentational — takes its image and copy as props, so each
 * page (ManageBookingHero, BookCarPage, …) supplies its own real asset
 * and translated text rather than this component inventing either.
 */
export function PageHero({ imageSrc, imageAlt, badge, title, subtitle }: PageHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-brand-navy">
      <img src={imageSrc} alt={imageAlt} loading="eager" className="absolute inset-0 h-full w-full object-cover object-center saturate-[1.05]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#05070d]/92 via-[#05070d]/55 to-[#05070d]/25" />

      <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto inline-flex items-center gap-2 border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-white backdrop-blur-md">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-champagne" aria-hidden="true" />
          {badge}
        </div>

        <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/80 sm:text-base">{subtitle}</p>
      </div>
    </section>
  )
}
