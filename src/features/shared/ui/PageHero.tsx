import { ShieldCheck } from 'lucide-react'
import { HeroStats, type HeroStat } from '@/features/shared/ui/HeroStats'

export interface PageHeroProps {
  imageSrc: string
  imageAlt: string
  badge: string
  title: string
  subtitle: string
  /** Optional strip of live numbers under the subtitle — same treatment as
   *  the homepage Hero's. Omitted entirely (not a skeleton) while the
   *  caller's own data is still loading, same "never a placeholder number"
   *  rule as HeroStats itself. */
  stats?: HeroStat[]
}

/**
 * A page-scale hero banner shared by secondary pages that deserve more
 * than the plain color-strip banner content pages use (About, Car
 * Types, …) — a real photo, a short badge, and a headline/subtitle pair.
 * Like the homepage's full-bleed Hero, it runs up underneath the fixed,
 * transparent header (`-mt-[var(--header-h)]` cancels Layout's top padding,
 * and the content adds the height back), so the photo reaches the very top
 * of the screen. Every route that renders this must be listed in NavBar's
 * PAGES_WITH_DARK_HERO so the header is white over it.
 *
 * Purely presentational — takes its image and copy as props, so each page
 * supplies its own real asset and translated text rather than this
 * component inventing either.
 */
export function PageHero({ imageSrc, imageAlt, badge, title, subtitle, stats }: PageHeroProps) {
  return (
    <section className="relative isolate -mt-[var(--header-h)] overflow-hidden bg-brand-navy">
      <img src={imageSrc} alt={imageAlt} loading="eager" className="absolute inset-0 h-full w-full object-cover object-center saturate-[1.05]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#05070d]/92 via-[#05070d]/55 to-[#05070d]/25" />
      {/* Darkens the top edge so the transparent header's white links stay legible. */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#05070d]/55 to-transparent" />

      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-[calc(var(--header-h)+4rem)] text-center sm:px-6 sm:pb-20 sm:pt-[calc(var(--header-h)+5rem)] lg:px-8">
        <div className="mx-auto inline-flex items-center gap-2 border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-white backdrop-blur-md">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-champagne" aria-hidden="true" />
          {badge}
        </div>

        <h1 className="font-hero-serif mx-auto mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/80 sm:text-base">{subtitle}</p>

        {stats && stats.length > 0 && <HeroStats className="mx-auto mt-8 max-w-xl" items={stats} />}
      </div>
    </section>
  )
}
