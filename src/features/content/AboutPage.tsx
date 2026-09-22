import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Mail, MapPin, MessageCircle } from 'lucide-react'
import { fetchAllAvailableVehicles, fetchLocations } from '@/features/booking/api'
import { GuidesFooter } from '@/features/blog/GuidesFooter'
import {
  OFFICE_ADDRESS,
  OFFICE_MAPS_URL,
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_HREF,
  WHATSAPP_URL,
} from '@/features/booking/contactLinks'
import { LocationsPreviewSection } from '@/features/booking/LocationsPreviewSection'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import { summarizeCoverage, summarizeFleet } from '@/features/content/aboutData'
import {
  CompanyProfile,
  CoverageDetails,
  FleetDetails,
  HowWeWork,
  SectionKicker,
  ValuesSection,
  VisionMission,
} from '@/features/content/AboutSections'
import { ClosingCta } from '@/features/shared/ui/ClosingCta'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import heroPremium from '@/assets/hero/hero-premium.webp'
import { prefersReducedMotion } from '@/lib/motion'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import { categoryLabel } from '@/lib/categoryName'
import { sortCategoriesPremiumFirst } from '@/lib/vehicleFilters'
import { primaryImage } from '@/lib/vehicleImages'
import type { Location, VehicleWithDetails } from '@/types/domain'

interface FleetCategory {
  id: string
  name: string
  description: string | null
  photoStoragePath: string | null
  count: number
}

/**
 * Bliss Rent's company profile. The page deliberately keeps only facts
 * supported by the live booking system or the established business copy:
 * fleet, coverage, booking steps, office and direct contact channels.
 */
export function AboutPage() {
  return (
    <>
      <AboutPageContent />
      <GuidesFooter
        slugs={[
          'car-rental-dubai-complete-guide',
          'how-to-book-a-rental-car-online-uae',
          'documents-needed-to-rent-a-car-uae',
        ]}
      />
    </>
  )
}

function AboutPageContent() {
  const { t } = useTranslation()
  useDocumentTitle(t('pages.about.title'))
  useMetaDescription(t('pages.about.subtitle'))

  const storyParagraphs = t('pages.about.story.paragraphs', { returnObjects: true }) as string[]
  const reducedMotion = prefersReducedMotion()
  const [vehicles, setVehicles] = useState<VehicleWithDetails[] | null>(null)
  const [locations, setLocations] = useState<Location[] | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchAllAvailableVehicles(), fetchLocations()])
      .then(([nextVehicles, nextLocations]) => {
        if (cancelled) return
        setVehicles(nextVehicles)
        setLocations(nextLocations)
      })
      .catch(() => {
        // Live sections are progressive enhancement; the company story and
        // contact paths remain complete if Supabase is temporarily unavailable.
      })

    return () => {
      cancelled = true
    }
  }, [])

  const fleetCategories = vehicles ? summarizeFleetCategories(vehicles) : null
  const fleet = vehicles ? summarizeFleet(vehicles) : null
  const coverage = locations ? summarizeCoverage(locations) : null

  return (
    // -mt-[var(--header-h)] pulls the page up under the fixed, transparent
    // header (Layout adds `pt-[var(--header-h)]` for it), so the hero image
    // runs to the very top of the screen exactly like the homepage's; the
    // hero adds that height back as its own top padding. NavBar lists this
    // route in PAGES_WITH_DARK_HERO so the header is white over it.
    <main className="-mt-[var(--header-h)] overflow-hidden bg-white text-brand-navy">
      <section className="relative isolate flex min-h-[calc(420px+var(--header-h))] items-center overflow-hidden bg-brand-navy pt-[var(--header-h)] sm:min-h-[calc(460px+var(--header-h))] lg:min-h-[calc(500px+var(--header-h))]">
        <img
          src={heroPremium}
          alt=""
          aria-hidden="true"
          loading="eager"
          className={
            'absolute inset-0 h-full w-full object-cover object-[62%_center] saturate-[1.05] contrast-[1.03]' +
            (reducedMotion ? '' : ' animate-hero-image-drift')
          }
        />
        {/* rtl:-scale-x-100 mirrors the gradient so the dark side always
            sits behind the text, which is at the inline-start (right in RTL). */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,10,26,0.96)_0%,rgba(7,10,26,0.82)_43%,rgba(7,10,26,0.2)_76%,rgba(7,10,26,0.12)_100%)] rtl:-scale-x-100" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-transparent to-brand-navy/15" />
        {/* Darkens the top edge so the transparent header's white links and controls stay legible over the bright sky. */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#05070d]/55 to-transparent" />

        {/* Vertically centered in the hero: equal space above and below (the
            section is `items-center`), not sitting on the bottom edge. */}
        <div className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
          <div className="max-w-3xl">
            <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.34em] text-brand-champagne">
              <span className="h-px w-10 bg-brand-champagne" aria-hidden="true" />
              {t('pages.about.hero.eyebrow')}
            </p>
            <h1 className="font-hero-serif mt-4 max-w-3xl text-3xl font-semibold leading-[1] tracking-[-0.055em] text-white sm:mt-5 sm:text-4xl lg:text-5xl">
              {t('pages.about.hero.heading')}
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-sm leading-6 text-white/78 sm:mt-5 sm:text-base sm:leading-7">
              {t('pages.about.hero.body')}
            </p>
            <div className="mt-5 flex flex-wrap gap-3 sm:mt-6">
              <LinkButton to="/book" variant="primary" className="group min-w-40">
                {t('nav.searchCars')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
              </LinkButton>
              <Link
                to="/search"
                className="inline-flex min-h-11 min-w-40 items-center justify-center border border-white/35 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-white hover:bg-white hover:text-brand-navy"
              >
                {t('hero.viewFleetCta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:gap-20 lg:px-8 lg:py-28">
          <div>
            <SectionKicker>{t('pages.about.story.eyebrow')}</SectionKicker>
            <h2 className="font-hero-serif mt-5 text-4xl font-semibold leading-[1.02] tracking-[-0.06em] text-brand-navy sm:text-5xl">
              {t('pages.about.story.heading')}
            </h2>
            <div className="mt-8 h-px w-24 bg-brand-champagne" aria-hidden="true" />
            <p className="mt-6 max-w-md text-sm font-semibold uppercase leading-6 tracking-[0.16em] text-brand-gold-dark">
              {t('pages.about.hero.note')}
            </p>
          </div>

          <div>
            <p className="border-s-2 border-brand-gold ps-6 text-xl font-medium leading-9 tracking-[-0.015em] text-brand-navy sm:text-2xl sm:leading-10">
              {storyParagraphs[0]}
            </p>
            <div className="mt-8 grid gap-6 text-sm leading-7 text-text-muted sm:grid-cols-2 sm:text-base">
              {storyParagraphs.slice(1).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
          <VisionMission />
        </div>
      </section>

      <ValuesSection />

      <CompanyProfile coverage={coverage} fleet={fleet} />
      <HowWeWork />

      {fleetCategories && fleetCategories.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <SectionKicker>{t('pages.about.fleet.eyebrow')}</SectionKicker>
                <h2 className="font-hero-serif mt-5 text-4xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-5xl">
                  {t('pages.about.fleet.heading')}
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-text-muted sm:text-base">{t('pages.about.fleet.subtitle')}</p>
              </div>
              <Link to="/search" className="group inline-flex items-center gap-2 text-sm font-semibold text-brand-gold-dark">
                {t('hero.viewFleetCta')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-12 grid gap-px bg-brand-navy/10 lg:grid-cols-2">
              {fleetCategories.map((category) => (
                <Link
                  key={category.id}
                  to={`/search?category=${category.id}`}
                  className="group relative min-h-[420px] overflow-hidden bg-brand-navy"
                >
                  <VehiclePhoto
                    storagePath={category.photoStoragePath}
                    alt={categoryLabel(t, category.name)}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-7 sm:p-9">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-champagne">
                          {t('pages.about.fleet.count', { count: category.count })}
                        </p>
                        <h3 className="font-hero-serif mt-2 text-3xl font-semibold text-white">{categoryLabel(t, category.name)}</h3>
                        {category.description && <p className="mt-3 max-w-md text-sm leading-6 text-white/72">{category.description}</p>}
                      </div>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-white/35 bg-white/10 text-white backdrop-blur-sm transition-colors group-hover:bg-white group-hover:text-brand-navy">
                        <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {fleet && <FleetDetails fleet={fleet} />}
          </div>
        </section>
      )}

      <LocationsPreviewSection />
      {coverage && <CoverageDetails coverage={coverage} />}

      <section className="mx-auto grid max-w-7xl gap-0 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
        <div className="relative min-h-[430px] overflow-hidden bg-brand-navy">
          <img src={heroPremium} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/80 via-brand-navy/15 to-transparent" />
          <div className="absolute inset-x-7 bottom-7 border-s-2 border-brand-champagne ps-4 text-white sm:inset-x-10 sm:bottom-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-champagne">{t('pages.about.connect.officeLabel')}</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/82">{OFFICE_ADDRESS}</p>
          </div>
        </div>

        <div className="flex flex-col justify-center bg-brand-gold px-7 py-12 text-white sm:px-10 lg:px-14">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-champagne">{t('pages.about.connect.eyebrow')}</p>
          <h2 className="font-hero-serif mt-5 text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl">
            {t('pages.about.connect.heading')}
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-7 text-white/78 sm:text-base">{t('pages.about.connect.subtitle')}</p>

          <div className="mt-9 grid gap-px bg-white/20 sm:grid-cols-2">
            <ContactLink href={WHATSAPP_URL} label={t('pages.about.connect.whatsappCta')} icon={MessageCircle} external />
            <ContactLink href={SUPPORT_EMAIL_HREF} label={SUPPORT_EMAIL} icon={Mail} />
            <ContactLink href={OFFICE_MAPS_URL} label={t('pages.contact.getDirections')} icon={MapPin} external />
            <ContactLink href="/contact" label={t('pages.about.connect.contactPageCta')} icon={ArrowRight} internal />
          </div>
        </div>
      </section>

      <ClosingCta eyebrow={t('pages.about.cta.eyebrow')} heading={t('pages.about.cta.heading')} />
    </main>
  )
}

function ContactLink({
  href,
  label,
  icon: Icon,
  external = false,
  internal = false,
}: {
  href: string
  label: string
  icon: typeof Mail
  external?: boolean
  internal?: boolean
}) {
  const className =
    'group flex min-h-20 items-center justify-between gap-3 bg-brand-gold px-4 py-4 text-sm font-semibold text-white transition-colors hover:bg-brand-gold-dark sm:px-5'
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-brand-champagne" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-white/60 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
    </>
  )

  if (internal) {
    return <Link to={href} className={className}>{content}</Link>
  }

  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} className={className}>
      {content}
    </a>
  )
}

function summarizeFleetCategories(vehicles: VehicleWithDetails[]): FleetCategory[] {
  const byId = new Map<string, FleetCategory>()
  for (const vehicle of vehicles) {
    const category = vehicle.vehicle_categories
    if (!category) continue
    const image = primaryImage(vehicle)
    const existing = byId.get(category.id)
    if (existing) {
      existing.count += 1
      if (!existing.photoStoragePath && image) existing.photoStoragePath = image.storage_path
    } else {
      byId.set(category.id, {
        id: category.id,
        name: category.name,
        description: category.description ?? null,
        photoStoragePath: image?.storage_path ?? null,
        count: 1,
      })
    }
  }
  return sortCategoriesPremiumFirst(Array.from(byId.values()))
}
