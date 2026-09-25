import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ChevronLeft, ChevronRight, Gauge } from 'lucide-react'
import { Eyebrow } from '@/features/shared/ui/Eyebrow'
import { CurrencySymbol } from '@/features/shared/ui/CurrencySymbol'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import { TERM_I18N_KEY } from '@/features/booking/VehicleCard'
import { categoryKey } from '@/lib/categoryName'
import { groupPublicVehicles } from '@/lib/vehicleGrouping'
import { cheapestHeadlineRate } from '@/lib/pricing'
import { aboutText, keyFigures } from '@/lib/vehicleSpecs'
import type { VehicleWithDetails } from '@/types/domain'

interface SportsCollectionSectionProps {
  vehicles: VehicleWithDetails[] | null
  failed?: boolean
}

const MAX_SPORTS_CARS = 8

/**
 * A second, deliberately editorial view of the live sports inventory. The
 * general Featured Vehicles row answers "what categories do you have?";
 * this carousel answers "which performance car do I want?" with one large
 * real vehicle photo and its real database specifications at a time.
 */
export function SportsCollectionSection({ vehicles, failed = false }: SportsCollectionSectionProps) {
  const { t } = useTranslation()
  const trackRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const sportsCars = useMemo(() => {
    if (!vehicles) return []
    const sportsOnly = vehicles.filter((vehicle) => categoryKey(vehicle.vehicle_categories?.name ?? '') === 'sports_supercars')
    return groupPublicVehicles(sportsOnly).slice(0, MAX_SPORTS_CARS)
  }, [vehicles])

  const activeIndex = Math.min(selectedIndex, Math.max(0, sportsCars.length - 1))

  if (failed || (vehicles !== null && sportsCars.length === 0)) return null

  function goTo(index: number) {
    const total = sportsCars.length
    if (total === 0) return
    const next = (index + total) % total
    setSelectedIndex(next)
    const track = trackRef.current
    track?.scrollTo?.({ left: track.clientWidth * next, behavior: 'smooth' })
  }

  function updateFromScroll() {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    const next = Math.round(track.scrollLeft / track.clientWidth)
    if (next >= 0 && next < sportsCars.length && next !== activeIndex) setSelectedIndex(next)
  }

  const categoryId = sportsCars[0]?.vehicle.category_id

  return (
    <section className="overflow-hidden py-8 sm:py-12 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <Eyebrow>{t('home.sportsShowcase.eyebrow')}</Eyebrow>
            <h2 className="font-hero-serif mt-3 text-2xl font-semibold leading-[1.02] tracking-[-0.055em] text-brand-navy sm:text-3xl md:text-4xl">
              {t('home.sportsShowcase.title')}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted sm:mt-4 sm:text-base sm:leading-7">{t('home.sportsShowcase.subtitle')}</p>
          </div>

          {sportsCars.length > 0 && (
            <div className="flex items-center gap-3">
              <p className="me-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-gold-dark" aria-live="polite">
                {String(activeIndex + 1).padStart(2, '0')} / {String(sportsCars.length).padStart(2, '0')}
              </p>
              <button
                type="button"
                onClick={() => goTo(activeIndex - 1)}
                disabled={sportsCars.length < 2}
                aria-label={t('home.sportsShowcase.previous')}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-gold/30 bg-white text-brand-navy transition-colors hover:bg-brand-gold hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => goTo(activeIndex + 1)}
                disabled={sportsCars.length < 2}
                aria-label={t('home.sportsShowcase.next')}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gold text-white transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {vehicles === null ? (
          <div className="mt-9 grid min-h-[34rem] animate-pulse overflow-hidden rounded-2xl bg-white shadow-(--shadow-card) lg:grid-cols-[1.15fr_0.85fr]" aria-hidden="true">
            <div className="bg-[#ddd2c6]" />
            <div className="bg-[#4d0a2b] p-8">
              <div className="h-3 w-32 bg-white/20" />
              <div className="mt-7 h-12 w-4/5 bg-white/15" />
              <div className="mt-4 h-20 bg-white/10" />
            </div>
          </div>
        ) : (
          <div
            ref={trackRef}
            onScroll={updateFromScroll}
            aria-label={t('home.sportsShowcase.carouselLabel')}
            className="mt-9 flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-2xl bg-white shadow-(--shadow-card) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sportsCars.map((group, index) => (
              <SportsSlide
                key={group.vehicle.id}
                vehicle={group.vehicle}
                quantity={group.quantity}
                active={index === activeIndex}
                position={index + 1}
                total={sportsCars.length}
              />
            ))}
          </div>
        )}

        {categoryId && (
          <div className="mt-6 flex justify-end">
            <Link
              to={`/search?category=${encodeURIComponent(categoryId)}`}
              className="group inline-flex min-h-11 items-center gap-2 border-b-2 border-brand-gold pb-1 text-sm font-semibold text-brand-navy"
            >
              {t('home.sportsShowcase.viewAll')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

function SportsSlide({
  vehicle,
  quantity,
  active,
  position,
  total,
}: {
  vehicle: VehicleWithDetails
  quantity: number
  active: boolean
  position: number
  total: number
}) {
  const { t, i18n } = useTranslation()
  const rate = cheapestHeadlineRate(vehicle.pricing)
  const figures = keyFigures(t, vehicle).slice(0, 3)
  const story = aboutText(vehicle, i18n.language) ?? t('home.sportsShowcase.fallbackBody')
  const image = vehicle.vehicle_images.find((item) => item.is_primary) ?? vehicle.vehicle_images[0]

  const fallbackFigures = [
    { key: 'year', label: t('vehicleSpecs.labels.year'), value: String(vehicle.model_year) },
    { key: 'seats', label: t('vehicleSpecs.labels.seats'), value: String(vehicle.seats) },
    {
      key: 'transmission',
      label: t('vehicleSpecs.labels.transmission'),
      value: t(`vehicleCard.transmission.${vehicle.transmission}`, { defaultValue: vehicle.transmission }),
    },
  ]
  const shownFigures = figures.length > 0 ? figures : fallbackFigures

  return (
    <article
      className="min-w-full snap-start"
      aria-label={t('home.sportsShowcase.slideLabel', { current: position, total })}
      aria-current={active ? 'true' : undefined}
    >
      <div className="grid min-h-[34rem] lg:grid-cols-[1.15fr_0.85fr]">
        <div className="group relative min-h-72 overflow-hidden bg-brand-lavender sm:min-h-[25rem] lg:min-h-[38rem]">
          <VehiclePhoto
            storagePath={image?.storage_path ?? null}
            alt={`${vehicle.make} ${vehicle.model}`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#210311]/60 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#260414]/22" />
          <span className="absolute start-5 top-5 rounded-full bg-white/94 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-brand-gold-dark backdrop-blur-sm sm:start-7 sm:top-7">
            {t('home.sportsShowcase.liveLabel')}
          </span>
          {quantity > 1 && (
            <span className="absolute bottom-5 start-5 rounded-full bg-brand-gold px-3 py-2 text-xs font-semibold text-white sm:bottom-7 sm:start-7">
              {t('vehicleCard.quantityAvailable', { count: quantity })}
            </span>
          )}
        </div>

        <div className="flex flex-col bg-[#4d082a] p-6 text-white sm:p-9 lg:p-12">
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-champagne">
            <Gauge className="h-4 w-4" aria-hidden="true" />
            {vehicle.make}
          </div>
          <h3 className="font-hero-serif mt-4 text-3xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-4xl lg:text-5xl">
            {vehicle.model}
          </h3>
          <p className="mt-5 max-h-[5.25rem] max-w-lg overflow-hidden text-sm leading-7 text-white/68 sm:max-h-none sm:text-base">{story}</p>

          <dl className="mt-7 grid grid-cols-3 border-y border-white/15">
            {shownFigures.map((figure) => (
              <div key={figure.key} className="border-e border-white/15 px-3 py-5 first:ps-0 last:border-e-0 last:pe-0 sm:px-5">
                <dt className="text-[8px] font-bold uppercase tracking-[0.06em] text-white/42 sm:text-[9px] sm:tracking-[0.16em]">{figure.label}</dt>
                <dd className="mt-2 text-sm font-semibold text-white sm:text-base">{figure.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-5 pt-8">
            <div>
              {rate ? (
                <>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-champagne">{t('vehicleCard.from')}</p>
                  <p className="mt-1 text-2xl font-bold tracking-[-0.03em]">
                    <CurrencySymbol currency={rate.currency} /> {rate.client_price.toLocaleString()}
                    <span className="ms-2 text-xs font-normal text-white/55">{t(TERM_I18N_KEY[rate.term])}</span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-white/60">{t('vehicleCard.pricingSoon')}</p>
              )}
            </div>
            <Link
              to={`/vehicles/${vehicle.id}`}
              tabIndex={active ? undefined : -1}
              className="group inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-champagne hover:text-brand-navy"
            >
              {t('home.sportsShowcase.viewCar')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
