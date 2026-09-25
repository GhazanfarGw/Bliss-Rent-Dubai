import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  BadgeCheck,
  CalendarRange,
  CircleDollarSign,
  Headphones,
  PlaneLanding,
  Route,
  UserRoundCheck,
} from 'lucide-react'
import openRoadImage from '@/assets/home/uae-open-road.jpg'
import { Eyebrow } from '@/features/shared/ui/Eyebrow'

interface CopyItem {
  title: string
  body: string
  action: string
}

interface ConfidenceItem {
  title: string
  body: string
}

const JOURNEY_ICONS = [PlaneLanding, Route, CalendarRange]
const JOURNEY_LINKS = ['/locations', '/blog/category/road-trips', '/search']
const CONFIDENCE_ICONS = [BadgeCheck, CircleDollarSign, UserRoundCheck, Headphones]

/**
 * Homepage-specific trip planning content. It points customers toward a
 * booking decision instead of repeating the company story, operating model,
 * coverage map and document lists already explained in full on About.
 */
export function HomeJourneyPlannerSection() {
  const { t } = useTranslation()
  const journeys = t('home.journeyPlanner.journeys', { returnObjects: true }) as CopyItem[]
  const confidence = t('home.journeyPlanner.confidence', { returnObjects: true }) as ConfidenceItem[]

  return (
    <section className="py-8 sm:py-12 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-3 sm:mb-8 sm:gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
          <div>
            <Eyebrow>{t('home.journeyPlanner.eyebrow')}</Eyebrow>
            <h2 className="font-hero-serif mt-3 max-w-2xl text-2xl font-semibold leading-tight tracking-[-0.055em] text-brand-navy sm:text-3xl md:text-4xl">
              {t('home.journeyPlanner.title')}
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-text-muted sm:text-base sm:leading-7 lg:justify-self-end lg:text-end">
            {t('home.journeyPlanner.subtitle')}
          </p>
        </div>

        <div className="grid overflow-hidden rounded-2xl bg-white shadow-(--shadow-card) lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative min-h-[22rem] overflow-hidden sm:min-h-[30rem] lg:min-h-[44rem]">
            <img
              src={openRoadImage}
              alt={t('home.journeyPlanner.imageAlt')}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover object-[58%_center]"
            />
          </div>

          <div className="flex flex-col p-5 sm:p-8 lg:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-gold-dark">{t('home.journeyPlanner.chooseLabel')}</p>
            <div className="mt-4 border-t border-border">
              {journeys.map((journey, index) => {
                const Icon = JOURNEY_ICONS[index] ?? Route
                return (
                  <Link
                    key={journey.title}
                    to={JOURNEY_LINKS[index] ?? '/search'}
                    className="group grid grid-cols-[auto_1fr_auto] items-start gap-4 border-b border-border py-6"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-gold/25 bg-white text-brand-gold transition-colors group-hover:bg-brand-gold group-hover:text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-base font-semibold text-brand-navy sm:text-lg">{journey.title}</span>
                      <span className="mt-1.5 block text-sm leading-6 text-text-muted">{journey.body}</span>
                      <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-gold-dark">
                        {journey.action}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" aria-hidden="true" />
                      </span>
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.18em] text-brand-navy/30">0{index + 1}</span>
                  </Link>
                )
              })}
            </div>

            <div className="mt-auto flex flex-wrap gap-3 pt-7">
              <button
                type="button"
                onClick={() => document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-gold px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-gold-dark"
              >
                {t('home.journeyPlanner.primaryCta')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" aria-hidden="true" />
              </button>
              <Link
                to="/locations"
                className="inline-flex min-h-12 items-center rounded-full border border-brand-gold/35 bg-white px-6 py-3 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-gold"
              >
                {t('home.journeyPlanner.secondaryCta')}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 grid overflow-hidden rounded-2xl bg-white shadow-(--shadow-card) sm:grid-cols-2 lg:grid-cols-4">
          {confidence.map((item, index) => {
            const Icon = CONFIDENCE_ICONS[index] ?? BadgeCheck
            return (
              <article key={item.title} className="grid grid-cols-[auto_1fr] gap-3 border-b border-border p-5 last:border-b-0 sm:border-border lg:border-b-0 lg:p-6">
                <Icon className="mt-0.5 h-5 w-5 text-brand-gold" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-brand-navy">{item.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-text-muted">{item.body}</p>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
