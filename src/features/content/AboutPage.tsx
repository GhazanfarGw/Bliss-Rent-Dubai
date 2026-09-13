import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Car, Compass, Eye, MapPin, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { fetchAllAvailableVehicles, fetchLocations } from '@/features/booking/api'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import { TYPE_ICON, TYPE_ORDER, sortByOrder } from '@/features/booking/locationDisplay'
import { primaryImage } from '@/lib/vehicleImages'
import { prefersReducedMotion } from '@/lib/motion'
import heroPremium from '@/assets/hero/hero-premium.webp'
import type { Location, VehicleWithDetails } from '@/types/domain'
import type { LocationType } from '@/types/database'

interface ValueItem {
  title: string
  body: string
}

interface FleetCategory {
  id: string
  name: string
  description: string | null
  photoStoragePath: string | null
  count: number
}

interface CityCoverage {
  city: string
  types: LocationType[]
  count: number
}

// One icon per value, in the same order as pages.about.values.items
// (Transparency, Simplicity, Reliability, Local focus) — purely visual,
// no new claims. Vision/Mission get their own icons below.
const VALUE_ICONS = [Eye, Sparkles, ShieldCheck, MapPin]

/**
 * About Us — full brand-page rebuild, pushed to the same bold "spicy
 * premium" treatment the homepage already carries (gradient-clip
 * headlines, glow-on-hover cards with an animated top accent line,
 * RequirementsSection's numbered-index pattern for Values), and
 * deliberately light — no flat dark-navy section backgrounds anywhere
 * on the page (the hero banner's photo-with-gradient-wash is a
 * different thing: a backdrop for white text over a photo, not a
 * dark content block). Every word of substance still comes from
 * pages.about.* in en.ts/ar.ts — real business facts only; the
 * *.eyebrow strings are pure section labels, not claims.
 *
 * Two sections here (Our Fleet, Where We Operate) go beyond the
 * original 3-number stat strip to real, richer, live data: a full
 * per-category breakdown with real photos (same fetchAllAvailableVehicles
 * query FeaturedVehicles/VehicleCategoriesSection already use) and a
 * full per-city coverage list with real location types (same
 * fetchLocations() query the search widget uses) — both render nothing
 * until resolved, and nothing at all on failure, never a fabricated
 * number or a placeholder category/city.
 */
export function AboutPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('pages.about.title'))
  useMetaDescription(t('pages.about.subtitle'))
  const storyParagraphs = t('pages.about.story.paragraphs', { returnObjects: true }) as string[]
  const values = t('pages.about.values.items', { returnObjects: true }) as ValueItem[]
  const reducedMotion = prefersReducedMotion()

  const [vehicles, setVehicles] = useState<VehicleWithDetails[] | null>(null)
  const [locations, setLocations] = useState<Location[] | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchAllAvailableVehicles(), fetchLocations()])
      .then(([v, l]) => {
        if (cancelled) return
        setVehicles(v)
        setLocations(l)
      })
      .catch(() => {
        // Best-effort only, same discipline as every other live section
        // sitewide — these two sections simply don't render.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const fleetCategories = vehicles ? summarizeFleetCategories(vehicles) : null
  const cityCoverage = locations ? summarizeCityCoverage(locations) : null
  const vehicleCount = vehicles?.length ?? 0
  const categoryCount = fleetCategories?.length ?? 0
  const cityCount = cityCoverage?.length ?? 0

  return (
    <div>
      {/* Banner — the real fleet-lineup hero photo (same asset Hero.tsx's
          carousel uses), with the same "Live" pulsing badge + Ken-Burns
          drift Hero.tsx established, so the brand page opens with the
          same energy as the homepage instead of a quieter static crop.
          This dark wash is a photo backdrop for legible white text, not
          a flat content-block background — the rest of the page below
          stays light throughout. */}
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

      {/* Bliss Rent today — a quick, scannable strip of the same three
          live numbers this page always showed; the detailed breakdowns
          below (Our Fleet, Where We Operate) are the real new depth, so
          this strip stays condensed rather than repeating their detail. */}
      {vehicles && locations && (
        <section className="bg-surface-warm-alt">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.36em] text-brand-gold">{t('pages.about.stats.eyebrow')}</p>
            <h2 className="mt-3 text-center text-2xl font-black tracking-[-0.04em] text-brand-navy sm:text-4xl">{t('pages.about.stats.heading')}</h2>
            <p className="mx-auto mt-2 max-w-md text-center text-sm text-text-muted">{t('pages.about.stats.subtitle')}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <StatCard icon={Car} value={vehicleCount} label={t('pages.about.stats.vehicles', { count: vehicleCount })} />
              <StatCard icon={Sparkles} value={categoryCount} label={t('pages.about.stats.categories', { count: categoryCount })} />
              <StatCard icon={MapPin} value={cityCount} label={t('pages.about.stats.cities', { count: cityCount })} />
            </div>
          </div>
        </section>
      )}

      {/* Our Fleet — real per-category breakdown: an actual representative
          photo, the category's own real description (vehicle_categories.
          description), and a live count, for every category that
          currently has at least one available vehicle. */}
      {fleetCategories && fleetCategories.length > 0 && (
        <section>
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold">{t('pages.about.fleet.eyebrow')}</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-brand-navy sm:text-4xl">{t('pages.about.fleet.heading')}</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">{t('pages.about.fleet.subtitle')}</p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {fleetCategories.map((category) => (
                <Link
                  key={category.id}
                  to={`/search?category=${category.id}`}
                  className="group overflow-hidden border border-[#ece7df] bg-white shadow-(--shadow-card) transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold hover:shadow-(--shadow-card-hover)"
                >
                  <div className="aspect-[16/9] overflow-hidden bg-brand-lavender/60">
                    <VehiclePhoto
                      storagePath={category.photoStoragePath}
                      alt={category.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-base font-bold text-brand-navy">{category.name}</h3>
                      <span className="shrink-0 text-xs font-semibold text-brand-gold-dark">
                        {t('pages.about.fleet.count', { count: category.count })}
                      </span>
                    </div>
                    {category.description && <p className="mt-2 text-sm leading-6 text-text-muted">{category.description}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Where We Operate — every real city currently live in `locations`,
          with which real pickup/drop-off types (airport/city/hotel/
          delivery) actually exist there — same fixed order and icons
          LocationField's picker and the Locations page already use. */}
      {cityCoverage && cityCoverage.length > 0 && (
        <section className="bg-surface-warm-alt">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold">{t('pages.about.coverage.eyebrow')}</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.06em] text-brand-navy sm:text-4xl">{t('pages.about.coverage.heading')}</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">{t('pages.about.coverage.subtitle')}</p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {cityCoverage.map(({ city, types, count }) => (
                <div key={city} className="border border-[#ece7df] bg-white p-6 shadow-(--shadow-card)">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-lg font-bold text-brand-navy">{city}</h3>
                    <span className="shrink-0 text-xs font-semibold text-text-muted">{t('pages.locations.pointCount', { count })}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {types.map((type) => (
                      <span key={type} className="inline-flex items-center gap-1.5 border border-border bg-surface-warm px-2.5 py-1 text-xs font-medium text-brand-navy">
                        <span aria-hidden="true">{TYPE_ICON[type]}</span>
                        {t(`pages.locations.${type}Heading`)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Vision & Mission */}
      <section>
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
      <section className="bg-surface-warm-alt">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
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
        </div>
      </section>

      {/* Closing CTA — the same light "floating white card on a warm
          band" pattern HomePage's own final CTA uses, not a solid navy
          block. */}
      <section className="relative overflow-hidden bg-surface-warm px-4 py-16 text-center sm:px-6 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/3 bg-brand-champagne/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-4xl border border-[#ece7df] bg-white p-8 shadow-[0_30px_70px_rgba(17,20,29,0.08)] sm:p-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold-dark">{t('pages.about.cta.eyebrow')}</p>
          <h2 className="mt-4 text-3xl font-black tracking-[-0.06em] text-brand-navy sm:text-5xl">{t('pages.about.cta.heading')}</h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <LinkButton to="/book" variant="primary" className="group">
              {t('nav.searchCars')}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
            </LinkButton>
            <Link
              to="/search"
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-brand-navy/15 bg-white px-5 py-2.75 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-lavender"
            >
              {t('hero.viewFleetCta')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

/** Groups the live, available-only fleet into one summary per category
 *  (real representative photo, real description, real live count) — the
 *  same grouping VehicleCategoriesSection/CarTypesPage already do for
 *  their own live category grids. */
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
  return Array.from(byId.values())
}

/** Groups real, live locations by city, listing which real types
 *  (airport/city/hotel/delivery) actually exist in each — same grouping
 *  LocationsPage already does for its own city cards. */
function summarizeCityCoverage(locations: Location[]): CityCoverage[] {
  const cities = Array.from(new Set(locations.map((l) => l.city))).sort((a, b) => sortByOrder(a, b, 'Dubai'))
  return cities.map((city) => {
    const cityLocations = locations.filter((l) => l.city === city)
    const types = TYPE_ORDER.filter((type) => cityLocations.some((l) => l.type === type))
    return { city, types, count: cityLocations.length }
  })
}

function StatCard({ icon: Icon, value, label }: { icon: typeof Car; value: number; label: string }) {
  return (
    <div className="group border border-[#ece7df] bg-white p-6 text-center shadow-(--shadow-card) transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold/40 hover:shadow-(--shadow-card-hover)">
      <span className="mx-auto flex h-11 w-11 items-center justify-center bg-brand-gold text-white transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_0_6px_rgba(212,175,55,0.18)]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-3xl font-black text-brand-navy">{value}</p>
      <p className="mt-1 text-sm text-text-muted">{label}</p>
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
