import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Compass, Eye, MapPin, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import heroLuxury from '@/assets/hero/hero-luxury.webp'

interface ValueItem {
  title: string
  body: string
}

// One icon per value, in the same order as pages.about.values.items
// (Transparency, Simplicity, Reliability, Local focus) — purely visual,
// no new claims. Vision/Mission get their own icons below.
const VALUE_ICONS = [Eye, Sparkles, ShieldCheck, MapPin]

/**
 * About Us — full brand-page redesign (Story, Vision, Mission, Values,
 * closing CTA), restyled to match the premium editorial system already
 * established sitewide (WhyChooseSection's eyebrow/headline pattern,
 * sharp-cornered bordered cards, gold accents). Every word of substance
 * still comes from pages.about.* in en.ts/ar.ts — real business facts
 * only, no invented awards, stats, testimonials, or team photos. The one
 * addition is pages.about.cta.heading, a plain booking prompt.
 */
export function AboutPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('pages.about.title'))
  const storyParagraphs = t('pages.about.story.paragraphs', { returnObjects: true }) as string[]
  const values = t('pages.about.values.items', { returnObjects: true }) as ValueItem[]

  return (
    <div>
      {/* Banner — reuses the same real hero photography as the homepage,
          just with a heavier navy wash since this is a contained page
          banner sitting under the already-solid header, not an immersive
          full-bleed hero. */}
      <section className="relative isolate overflow-hidden bg-brand-navy">
        <img
          src={heroLuxury}
          alt=""
          aria-hidden="true"
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/90 via-brand-navy/85 to-brand-navy" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-brand-champagne">{t('nav.about')}</p>
          <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">{t('pages.about.title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-brand-lavender sm:text-base">{t('pages.about.subtitle')}</p>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
        <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-brand-gold-dark">{t('pages.about.story.heading')}</p>
        <div className="mt-4 space-y-5 border-s-2 border-brand-gold/30 ps-6">
          {storyParagraphs.map((p, i) => (
            <p
              key={i}
              className={
                i === 0
                  ? 'text-lg font-medium leading-8 text-brand-navy'
                  : 'text-sm leading-7 text-text-muted sm:text-base'
              }
            >
              {p}
            </p>
          ))}
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="bg-[#f8f5f0]">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="border border-[#ece7df] bg-white p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-none bg-brand-navy text-white">
                <Compass className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-lg font-bold text-brand-navy">{t('pages.about.vision.heading')}</h2>
              <p className="mt-2 text-sm leading-7 text-text-muted">{t('pages.about.vision.body')}</p>
            </div>
            <div className="border border-[#ece7df] bg-white p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-none bg-brand-navy text-white">
                <Target className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-lg font-bold text-brand-navy">{t('pages.about.mission.heading')}</h2>
              <p className="mt-2 text-sm leading-7 text-text-muted">{t('pages.about.mission.body')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-[-0.06em] text-brand-navy sm:text-4xl">{t('pages.about.values.heading')}</h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((item, i) => {
            const Icon = VALUE_ICONS[i] ?? ShieldCheck
            return (
              <div key={item.title} className="border border-[#ece7df] bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-none bg-brand-gold text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-sm font-semibold text-brand-navy">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-text-muted">{item.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-brand-navy px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">{t('pages.about.cta.heading')}</h2>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <LinkButton to="/book" variant="primary">
            {t('nav.searchCars')}
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
      </section>
    </div>
  )
}
