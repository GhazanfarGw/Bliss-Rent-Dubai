import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CircleCheck, Compass, Eye, Globe, KeyRound, LifeBuoy, MapPin, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { BrandMark } from '@/features/booking/BrandMark'
import {
  OFFICE_ADDRESS,
  OFFICE_MAPS_URL,
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_HREF,
  WHATSAPP_PHONE_DISPLAY,
  WHATSAPP_URL,
} from '@/features/booking/contactLinks'
import { TYPE_HEADING_KEY, TYPE_ICON } from '@/features/booking/locationDisplay'
import { cityPagePath } from '@/features/content/cityGuides'
import { formatRange, type CoverageSummary, type FleetSummary } from '@/features/content/aboutData'
import heroLuxury from '@/assets/hero/hero-luxury.webp'

/**
 * The About page's company-profile sections. Every number here is passed in
 * from live data (see aboutData.ts) and every fact is one the business has
 * already established elsewhere on the site (self-drive only, website-only
 * booking, WhatsApp for support, the listed office, the rental periods) —
 * nothing on this page invents a policy, a price or a statistic.
 */

interface CopyItem {
  title: string
  body: string
}

interface DocumentGroup {
  title: string
  items: string[]
}

const PRINCIPLE_ICONS = [Globe, KeyRound, MapPin, LifeBuoy]
const VALUE_ICONS = [Eye, Sparkles, ShieldCheck, MapPin]

export function SectionKicker({ children, light = false }: { children: string; light?: boolean }) {
  return (
    <p className={`flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.32em] ${light ? 'text-brand-champagne' : 'text-brand-gold-dark'}`}>
      <span className={`h-px w-8 ${light ? 'bg-brand-champagne' : 'bg-brand-gold'}`} aria-hidden="true" />
      {children}
    </p>
  )
}

/**
 * Vision & mission: a photo beside a white panel holding the two
 * statements. Just the box — the page supplies its own section spacing.
 */
export function VisionMission() {
  const { t } = useTranslation()

  return (
    <div className="white-box grid overflow-hidden lg:grid-cols-[1.08fr_0.92fr]">
      <div className="relative min-h-80 overflow-hidden lg:min-h-[520px]">
        <img src={heroLuxury} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/70 via-transparent to-transparent" />
        <p className="absolute inset-x-6 bottom-6 max-w-md text-sm leading-6 text-white/80 sm:inset-x-10 sm:bottom-10">
          {t('pages.about.subtitle')}
        </p>
      </div>
      <div className="flex flex-col justify-center px-7 py-12 sm:px-10 lg:px-14">
        <SectionKicker>{t('pages.about.visionMissionEyebrow')}</SectionKicker>
        <Statement icon={Compass} heading={t('pages.about.vision.heading')} body={t('pages.about.vision.body')} />
        <div className="my-8 h-px bg-brand-navy/10" aria-hidden="true" />
        <Statement icon={Target} heading={t('pages.about.mission.heading')} body={t('pages.about.mission.body')} />
      </div>
    </div>
  )
}

function Statement({ icon: Icon, heading, body }: { icon: typeof Compass; heading: string; body: string }) {
  return (
    <div className="mt-8 grid grid-cols-[auto_1fr] gap-5">
      <span className="flex h-11 w-11 items-center justify-center border border-brand-gold/25 bg-brand-gold/5 text-brand-gold">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-lg font-semibold text-brand-navy">{heading}</h3>
        <p className="mt-2 text-sm leading-7 text-text-muted">{body}</p>
      </div>
    </div>
  )
}

/** "What we stand for" — the four company values as a row of white boxes. */
export function ValuesSection() {
  const { t } = useTranslation()
  const values = t('pages.about.values.items', { returnObjects: true }) as CopyItem[]

  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <SectionKicker>{t('pages.about.values.eyebrow')}</SectionKicker>
            <h2 className="font-hero-serif mt-5 text-4xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-5xl">
              {t('pages.about.values.heading')}
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-text-muted sm:text-base">{t('pages.about.mission.body')}</p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((item, index) => {
            const Icon = VALUE_ICONS[index] ?? ShieldCheck
            return (
              <article key={item.title} className="white-box p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <Icon className="h-6 w-6 text-brand-gold" aria-hidden="true" />
                  <span className="font-mono text-xs tracking-[0.2em] text-brand-navy/35">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-7 text-lg font-semibold text-brand-navy">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-text-muted">{item.body}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** "Bliss Rent at a glance" — the company's essential facts as a label/value ledger. */
export function CompanyProfile({ coverage, fleet }: { coverage: CoverageSummary | null; fleet: FleetSummary | null }) {
  const { t } = useTranslation()
  const linkClass = 'font-medium text-brand-gold-dark underline-offset-4 hover:underline'

  const rows: { key: string; label: string; value: ReactNode }[] = [
    { key: 'business', label: t('pages.about.profile.rows.business.label'), value: t('pages.about.profile.rows.business.value') },
    {
      key: 'office',
      label: t('pages.about.profile.rows.office.label'),
      value: (
        <a href={OFFICE_MAPS_URL} target="_blank" rel="noreferrer" className={linkClass}>
          {OFFICE_ADDRESS}
        </a>
      ),
    },
  ]

  if (coverage && coverage.cities.length > 0) {
    rows.push({
      key: 'coverage',
      label: t('pages.about.profile.rows.coverage.label'),
      value: t('pages.about.profile.rows.coverage.value', {
        cities: coverage.cities.length,
        airports: coverage.airportCount,
        points: coverage.pointCount,
      }),
    })
  }
  if (fleet && fleet.vehicleCount > 0) {
    rows.push({
      key: 'fleet',
      label: t('pages.about.profile.rows.fleet.label'),
      value: t('pages.about.profile.rows.fleet.value', {
        vehicles: fleet.vehicleCount,
        brands: fleet.brands.length,
        categories: fleet.categoryCount,
      }),
    })
  }

  rows.push(
    { key: 'periods', label: t('pages.about.profile.rows.periods.label'), value: t('pages.about.profile.rows.periods.value') },
    { key: 'booking', label: t('pages.about.profile.rows.booking.label'), value: t('pages.about.profile.rows.booking.value') },
    { key: 'driving', label: t('pages.about.profile.rows.driving.label'), value: t('pages.about.profile.rows.driving.value') },
    {
      key: 'support',
      label: t('pages.about.profile.rows.support.label'),
      value: (
        <span className="flex flex-wrap gap-x-5 gap-y-1">
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" dir="ltr" className={linkClass}>
            WhatsApp {WHATSAPP_PHONE_DISPLAY}
          </a>
          <a href={SUPPORT_EMAIL_HREF} className={linkClass}>
            {SUPPORT_EMAIL}
          </a>
        </span>
      ),
    },
    { key: 'languages', label: t('pages.about.profile.rows.languages.label'), value: t('pages.about.profile.rows.languages.value') },
  )

  return (
    <section>
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:px-8 lg:py-28">
        <div>
          <SectionKicker>{t('pages.about.profile.eyebrow')}</SectionKicker>
          <h2 className="font-hero-serif mt-5 text-4xl font-semibold leading-[1.02] tracking-[-0.06em] text-brand-navy sm:text-5xl">
            {t('pages.about.profile.heading')}
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-text-muted">{t('pages.about.profile.subtitle')}</p>
        </div>

        <dl className="border-t border-brand-navy/10">
          {rows.map((row) => (
            <div key={row.key} className="grid gap-1 border-b border-brand-navy/10 py-5 sm:grid-cols-[11rem_1fr] sm:gap-8">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold-dark">{row.label}</dt>
              <dd className="text-sm leading-7 text-brand-navy sm:text-base">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

/** The operating model: four service principles, the four booking steps, and what to bring to pickup. */
export function HowWeWork() {
  const { t } = useTranslation()
  const principles = t('pages.about.operations.principles', { returnObjects: true }) as CopyItem[]
  const steps = t('home.howItWorks.steps', { returnObjects: true }) as CopyItem[]
  const documentGroups = t('home.documents.groups', { returnObjects: true }) as DocumentGroup[]

  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="max-w-3xl">
          <SectionKicker>{t('pages.about.operations.eyebrow')}</SectionKicker>
          <h2 className="font-hero-serif mt-5 text-4xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-5xl">
            {t('pages.about.operations.heading')}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">{t('pages.about.operations.subtitle')}</p>
        </div>

        <h3 className="mt-14 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-gold-dark">
          {t('pages.about.operations.principlesHeading')}
        </h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {principles.map((principle, index) => {
            const Icon = PRINCIPLE_ICONS[index] ?? Globe
            return (
              <article key={principle.title} className="white-box p-7 sm:p-8">
                <span className="flex h-11 w-11 items-center justify-center border border-brand-gold/25 text-brand-gold">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h4 className="mt-5 text-lg font-semibold text-brand-navy">{principle.title}</h4>
                <p className="mt-2 text-sm leading-7 text-text-muted">{principle.body}</p>
              </article>
            )
          })}
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-gold-dark">{t('pages.about.operations.stepsHeading')}</h3>
            <ol className="mt-6 border-s border-brand-navy/15">
              {steps.map((step, index) => (
                <li key={step.title} className="relative ps-8 pb-8 last:pb-0">
                  <span className="absolute -start-4 top-0 flex h-8 w-8 items-center justify-center bg-brand-gold text-sm font-semibold text-white" aria-hidden="true">
                    {index + 1}
                  </span>
                  <p className="text-base font-semibold text-brand-navy">{step.title}</p>
                  <p className="mt-1 text-sm leading-7 text-text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-gold-dark">{t('pages.about.operations.bringHeading')}</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {documentGroups.map((group) => (
                <div key={group.title} className="white-box p-5">
                  <p className="text-sm font-semibold text-brand-navy">{group.title}</p>
                  <ul className="mt-3 space-y-2">
                    {group.items.map((item) => (
                      <li key={item} className="flex gap-2 text-sm leading-6 text-text-muted">
                        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-brand-gold-dark">
              <Link to="/contact" className="group inline-flex items-center gap-2">
                {t('home.documents.contactLink')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
              </Link>
              <Link to="/faqs" className="group inline-flex items-center gap-2">
                {t('pages.about.operations.faqCta')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Live fleet specifications plus the real brands in the fleet, shown under the category cards. */
export function FleetDetails({ fleet }: { fleet: FleetSummary }) {
  const { t } = useTranslation()

  const specs: { label: string; value: string }[] = []
  if (fleet.brands.length > 0) specs.push({ label: t('pages.about.fleetDetails.brands'), value: String(fleet.brands.length) })
  if (fleet.yearRange) specs.push({ label: t('pages.about.fleetDetails.years'), value: formatRange(fleet.yearRange) })
  if (fleet.seatRange) specs.push({ label: t('pages.about.fleetDetails.seats'), value: formatRange(fleet.seatRange) })
  if (fleet.transmissions.length > 0) {
    specs.push({
      label: t('pages.about.fleetDetails.transmission'),
      value: fleet.transmissions.map((transmission) => t(`vehicleCard.transmission.${transmission}`, { defaultValue: transmission })).join(' · '),
    })
  }

  return (
    <>
      {specs.length > 0 && (
        <div className="mt-12 grid gap-px bg-brand-navy/10 sm:grid-cols-2 lg:grid-cols-4">
          {specs.map((spec) => (
            <div key={spec.label} className="bg-surface-warm px-6 py-7">
              <p className="font-hero-serif text-3xl font-semibold lining-nums text-brand-navy">{spec.value}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{spec.label}</p>
            </div>
          ))}
        </div>
      )}

      {fleet.brands.length > 0 && (
        <div className="mt-16">
          <h3 className="font-hero-serif text-3xl font-semibold tracking-[-0.05em] text-brand-navy sm:text-4xl">{t('pages.about.fleetDetails.brandsHeading')}</h3>
          <p className="mt-2 text-sm text-text-muted">{t('pages.about.fleetDetails.brandsSubtitle')}</p>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-6 sm:gap-x-6">
            {fleet.brands.map((brand) => (
              <li key={brand} className="group flex w-[100px] flex-col items-center">
                <div className="flex h-24 w-full items-center justify-center opacity-70 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0">
                  <BrandMark name={brand} />
                </div>
                <p className="mt-2 text-center text-xs font-semibold tracking-[0.12em] text-brand-navy">{brand}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

/** City-by-city directory of every live pickup / drop-off point — sits under the coverage map. */
export function CoverageDetails({ coverage }: { coverage: CoverageSummary }) {
  const { t } = useTranslation()
  if (coverage.cities.length === 0) return null

  const stats = [
    { label: t('pages.about.coverageDetails.cities'), value: coverage.cities.length },
    { label: t('pages.about.coverageDetails.airports'), value: coverage.airportCount },
    ...(['city', 'hotel', 'delivery'] as const).map((type) => ({ label: t(TYPE_HEADING_KEY[type]), value: coverage.countsByType[type] })),
  ].filter((stat) => stat.value > 0)

  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
        <div className="max-w-3xl">
          <SectionKicker>{t('pages.about.coverageDetails.eyebrow')}</SectionKicker>
          <h2 className="font-hero-serif mt-5 text-3xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-4xl">
            {t('pages.about.coverageDetails.heading')}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">{t('pages.about.coverageDetails.subtitle')}</p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-px bg-brand-navy/10 sm:auto-cols-fr sm:grid-flow-col">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white px-5 py-6">
              <p className="font-hero-serif text-3xl font-semibold lining-nums text-brand-navy">{stat.value}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase leading-4 tracking-[0.14em] text-text-muted">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {coverage.cities.map(({ city, points, types }) => {
            const guidePath = cityPagePath(city)
            return (
              <article key={city} className="flex flex-col border border-brand-gold/15 bg-white p-6">
                <header className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-semibold text-brand-navy">{city}</h3>
                  <span className="shrink-0 text-xs font-medium text-text-muted">{t('pages.locations.pointCount', { count: points.length })}</span>
                </header>

                {types.map((type) => (
                  <div key={type} className="mt-5">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-gold-dark">
                      <span aria-hidden="true">{TYPE_ICON[type]}</span>
                      {t(TYPE_HEADING_KEY[type])}
                    </p>
                    <ul className="mt-2">
                      {points
                        .filter((point) => point.type === type)
                        .map((point) => (
                          <li key={point.id} className="border-t border-brand-navy/10 py-1.5 text-sm text-brand-navy first:border-t-0 first:pt-0">
                            {point.name}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}

                {guidePath && (
                  <Link to={guidePath} className="group mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-brand-gold-dark">
                    {t('pages.about.coverageDetails.viewGuide')}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
                  </Link>
                )}
              </article>
            )
          })}
        </div>

        <p className="mt-8 text-xs text-text-muted">{t('pages.about.coverageDetails.growth')}</p>
      </div>
    </section>
  )
}
