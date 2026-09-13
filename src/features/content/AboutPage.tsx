import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Car, Compass, Eye, MapPin, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { useFleetStats } from '@/features/booking/useFleetStats'
import { prefersReducedMotion } from '@/lib/motion'
import heroPremium from '@/assets/hero/hero-premium.webp'

interface ValueItem {
  title: string
  body: string
}

// One icon per value, in the same order as pages.about.values.items
// (Transparency, Simplicity, Reliability, Local focus) — purely visual,
// no new claims. Vision/Mission get their own icons below.
const VALUE_ICONS = [Eye, Sparkles, ShieldCheck, MapPin]

/**
 * About Us — full brand-page rebuild, pushed to the same bold "spicy
 * premium" treatment the homepage already carries (gradient-clip
 * headlines, glow-on-hover cards with an animated top accent line,
 * RequirementsSection's numbered-index pattern for Values) rather than
 * the flatter bordered-box style this page used before. Every word of
 * substance still comes from pages.about.* in en.ts/ar.ts — real
 * business facts only; the new *.eyebrow strings added alongside are
 * pure section labels (the same decorative role every eyebrow tag
 * elsewhere on the site plays), not claims. The stats section is the
 * one place with numbers, and they're fetched live from the same
 * fleet/locations queries the homepage already uses — never a
 * hand-typed figure.
 */
export function AboutPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('pages.about.title'))
  useMetaDescription(t('pages.about.subtitle'))
  const storyParagraphs = t('pages.about.story.paragraphs', { returnObjects: true }) as string[]
  const values = t('pages.about.values.items', { returnObjects: true }) as ValueItem[]
  const stats = useFleetStats()
  const reducedMotion = prefersReducedMotion()

  return (
    <div>
      {/* Banner — the real fleet-lineup hero photo (same asset Hero.tsx's
          carousel uses), with the same "Live" pulsing badge + Ken-Burns
          drift Hero.tsx established, so the brand page opens with the
          same energy as the homepage instead of a quieter static crop. */}
      <section className="relative isolate overflow-hidden bg-brand-navy">
        <img
          src={heroPremium}
          alt=""
          aria-hidden="true"
          loading="eager"
          className={
            'absolute inset-0 h-full w-full object-cover object-center saturate-[1.1] contrast-[1.05]' +
            (reducedMotion ? '' : ' animate-hero-image-drift')
          }
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/92 via-brand-navy/80 to-brand-navy" />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <div className="inline-flex items-center gap-2 border border-white/35 bg-[#120f0a]/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.33em] text-white backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              {!reducedMotion && <span className="absolute inline-flex h-full w-full animate-ping bg-brand-champagne opacity-75" />}
              <span className="relative inline-flex h-2 w-2 bg-brand-gold" />
            </span>
            {t('nav.about')}
          </div>
          <h1 className="mt-5 text-4xl font-black leading-[0.95] tracking-[-0.05em] text-white drop-shadow-[0_16px_28px_rgba(0,0,0,0.35)] sm:text-6xl">
            {t('pages.about.title')}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-brand-lavender sm:text-base">{t('pages.about.subtitle')}</p>
        </div>
      </section>

      {/* Story — the first paragraph gets a bigger pull-quote treatment; the rest reads as normal body copy. */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
        <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-brand-gold">{t('pages.about.story.eyebrow')}</p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
          <span className="bg-gradient-to-r from-brand-navy via-brand-navy-light to-brand-gold-dark bg-clip-text text-transparent">
            {t('pages.about.story.heading')}
          </span>
        </h2>
        <div className="mt-6 space-y-5">
          {storyParagraphs.map((p, i) =>
            i === 0 ? (
              <p key={i} className="border-s-4 border-brand-gold ps-6 text-xl font-medium leading-9 tracking-[-0.01em] text-brand-navy">
                {p}
              </p>
            ) : (
              <p key={i} className="ps-6 text-sm leading-7 text-text-muted sm:text-base">
                {p}
              </p>
            ),
          )}
        </div>
      </section>

      {/* Bliss Rent today — live data, not marketing copy: same fleet
          and locations queries the homepage's category grid and search
          widget already run. Renders nothing until the fetch resolves,
          and nothing at all if it fails — never a fabricated number. */}
      {stats && (
        <section className="relative isolate overflow-hidden bg-brand-navy">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 h-80 w-80 -translate-y-1/3 translate-x-1/3 bg-brand-champagne/15 blur-3xl"
          />
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-brand-champagne">{t('pages.about.stats.eyebrow')}</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white sm:text-4xl">{t('pages.about.stats.heading')}</h2>
              <p className="mt-2 text-sm text-brand-lavender">{t('pages.about.stats.subtitle')}</p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              <StatCard
                icon={Car}
                value={stats.vehicleCount}
                label={t('pages.about.stats.vehicles', { count: stats.vehicleCount })}
              />
              <StatCard
                icon={Sparkles}
                value={stats.categoryNames.length}
                label={t('pages.about.stats.categories', { count: stats.categoryNames.length })}
                detail={stats.categoryNames.length > 0 ? stats.categoryNames.join(' · ') : undefined}
              />
              <StatCard
                icon={MapPin}
                value={stats.cityNames.length}
                label={t('pages.about.stats.cities', { count: stats.cityNames.length })}
                detail={stats.cityNames.length > 0 ? stats.cityNames.join(' · ') : undefined}
              />
            </div>
          </div>
        </section>
      )}

      {/* Vision & Mission */}
      <section className="bg-surface-warm-alt">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.36em] text-brand-gold">
            {t('pages.about.visionMissionEyebrow')}
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <SpicyCard icon={Compass} heading={t('pages.about.vision.heading')} body={t('pages.about.vision.body')} />
            <SpicyCard icon={Target} heading={t('pages.about.mission.heading')} body={t('pages.about.mission.body')} />
          </div>
        </div>
      </section>

      {/* Values — RequirementsSection's numbered-index card pattern. */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold">{t('pages.about.values.eyebrow')}</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-brand-navy sm:text-4xl">{t('pages.about.values.heading')}</h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((item, i) => {
            const Icon = VALUE_ICONS[i] ?? ShieldCheck
            return (
              <div
                key={item.title}
                className="group border border-[#ece7df] bg-white p-6 shadow-(--shadow-card) transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold/40 hover:shadow-(--shadow-card-hover)"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center bg-brand-gold text-white shadow-none transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_0_6px_rgba(212,175,55,0.18)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs font-semibold tracking-[0.18em] text-brand-gold">{`0${i + 1}`}</span>
                </div>
                <h3 className="mt-5 text-sm font-semibold text-brand-navy">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-text-muted">{item.body}</p>
                <div className="mt-5 h-px w-full bg-brand-gold/30 transition-colors duration-300 group-hover:bg-brand-gold" />
              </div>
            )
          })}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative isolate overflow-hidden bg-brand-navy px-4 py-20 text-center sm:px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/3 bg-brand-champagne/20 blur-3xl"
        />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-brand-champagne">{t('pages.about.cta.eyebrow')}</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white sm:text-4xl">{t('pages.about.cta.heading')}</h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <LinkButton to="/book" variant="primary" className="group">
              {t('nav.searchCars')}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
            </LinkButton>
            {/* Hand-built rather than LinkButton's `outline` variant: that
                variant hardcodes a navy border/text meant for a light
                background, and overriding its color classes via className
                risks losing the cascade fight (Tailwind's generated CSS
                order, not class-string order, decides ties — the same
                pointer-events bug fixed in NavBar this session). */}
            <Link
              to="/search"
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/70 bg-transparent px-5 py-2.75 text-sm font-semibold text-white transition-all hover:bg-white/10"
            >
              {t('hero.viewFleetCta')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function StatCard({
  icon: Icon,
  value,
  label,
  detail,
}: {
  icon: typeof Car
  value: number
  label: string
  detail?: string
}) {
  return (
    <div className="group border border-white/15 bg-white/5 p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-brand-champagne/50 hover:bg-white/[0.08]">
      <span className="mx-auto flex h-11 w-11 items-center justify-center bg-white/10 text-brand-champagne transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_0_6px_rgba(212,175,55,0.15)]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm text-brand-lavender">{label}</p>
      {detail && <p className="mt-2 text-xs text-brand-lavender/70">{detail}</p>}
    </div>
  )
}

function SpicyCard({ icon: Icon, heading, body }: { icon: typeof Compass; heading: string; body: string }) {
  return (
    <div className="group relative overflow-hidden border border-[#ece7df] bg-white p-7 shadow-(--shadow-card) transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold/40 hover:shadow-(--shadow-card-hover)">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-brand-champagne transition-transform duration-300 group-hover:scale-x-100"
      />
      <span className="flex h-11 w-11 items-center justify-center bg-brand-navy text-white transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_0_6px_rgba(11,19,43,0.15)]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-lg font-bold text-brand-navy">{heading}</h2>
      <p className="mt-2 text-sm leading-7 text-text-muted">{body}</p>
    </div>
  )
}
