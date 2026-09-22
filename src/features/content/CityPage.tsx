import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Compass, Lightbulb, MapPin } from 'lucide-react'
import { postsForCity } from '@/features/blog/blogPosts'
import { RelatedGuides } from '@/features/blog/RelatedGuides'
import { fetchLocations } from '@/features/booking/api'
import { CITY_PHOTOS } from '@/features/booking/cityPhotos'
import { TYPE_ICON, TYPE_ORDER } from '@/features/booking/locationDisplay'
import { CITY_GUIDES, findGuideBySlug, type CityGuide } from '@/features/content/cityGuides'
import { NotFoundPage } from '@/features/content/NotFoundPage'
import { LoadingState } from '@/features/shared/ui/LoadingState'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { SITE_URL, useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import { useJsonLd } from '@/lib/useJsonLd'
import { WHATSAPP_URL } from '@/features/booking/contactLinks'
import type { Location } from '@/types/domain'
import type { LocationType } from '@/types/database'

type PointsState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; points: Location[] }

/** Same already-translated per-type headings the /locations page uses. */
const TYPE_HEADING_KEY: Record<LocationType, string> = {
  airport: 'pages.locations.airportHeading',
  city: 'pages.locations.cityHeading',
  hotel: 'pages.locations.hotelHeading',
  delivery: 'pages.locations.deliveryHeading',
}

/**
 * One page per emirate's main city (/locations/:slug) — marketing/SEO
 * content about the city (see cityGuides.ts) around the real, live pickup
 * points for it from the same `fetchLocations()` the search widget and
 * the /locations page use, so what it lists can't drift from what's
 * actually bookable. A slug with no guide is a real 404.
 */
export function CityPage() {
  const { slug } = useParams()
  const guide = findGuideBySlug(slug)
  if (!guide) return <NotFoundPage />
  return <CityGuideView guide={guide} />
}

function CityGuideView({ guide }: { guide: CityGuide }) {
  const { t, i18n } = useTranslation()
  const copy = i18n.language === 'ar' ? guide.ar : guide.en
  const photo = CITY_PHOTOS[guide.city]
  const [state, setState] = useState<PointsState>({ status: 'loading' })

  useDocumentTitle(t('pages.cityGuide.title', { city: copy.name }))
  useMetaDescription(copy.metaDescription)

  const pageUrl = `${SITE_URL}/locations/${guide.slug}`
  useJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: t('pages.locations.title'), item: `${SITE_URL}/locations` },
          { '@type': 'ListItem', position: 3, name: copy.name, item: pageUrl },
        ],
      },
      {
        '@type': 'City',
        name: copy.name,
        description: copy.metaDescription,
        url: pageUrl,
        containedInPlace: { '@type': 'Country', name: 'United Arab Emirates' },
      },
    ],
  })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetchLocations()
      .then((all) => {
        if (!cancelled) setState({ status: 'loaded', points: all.filter((l) => l.city === guide.city) })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [guide.city])

  const otherGuides = CITY_GUIDES.filter((g) => g.slug !== guide.slug)
  const guidePosts = postsForCity(guide.slug).slice(0, 3)

  return (
    <div className="bg-white text-brand-navy">
      {/* Hero: breadcrumb, headline and CTAs beside the city's photo. */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-14 lg:pt-10">
        <nav aria-label={t('pages.cityGuide.breadcrumbLabel')} className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
          <Link to="/" className="hover:text-brand-gold-dark">
            {t('nav.home')}
          </Link>
          <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
          <Link to="/locations" className="hover:text-brand-gold-dark">
            {t('pages.locations.title')}
          </Link>
          <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
          <span aria-current="page" className="font-semibold text-brand-navy">
            {copy.name}
          </span>
        </nav>

        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold-dark">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {t('pages.cityGuide.heroBadge')}
            </p>
            <h1 className="font-hero-serif mt-4 text-4xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-5xl">
              {t('pages.cityGuide.title', { city: copy.name })}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-text-muted">{copy.tagline}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <LinkButton to="/book" variant="primary">
                {t('pages.cityGuide.bookCta')}
              </LinkButton>
              <LinkButton to="/locations" variant="outline">
                {t('pages.cityGuide.allLocationsCta')}
              </LinkButton>
            </div>
          </div>

          {photo && (
            <figure className="relative overflow-hidden border border-brand-gold/15 bg-brand-lavender shadow-(--shadow-card)">
              <img src={photo.largeSrc} alt={copy.name} loading="eager" className="aspect-[4/3] h-full w-full object-cover" />
              {/* CC BY / CC BY-SA photo: the author and license credit is
                  required, and it lives here — with the photo itself. */}
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6 text-[10px] text-white/90">
                <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                  {t('pages.cityGuide.photoBy', { author: photo.author, license: photo.license })}
                </a>
              </figcaption>
            </figure>
          )}
        </div>
      </section>

      {/* Intro */}
      <section className="mx-auto max-w-3xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="space-y-4 text-base leading-8 text-brand-navy/85">
          {copy.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      {/* Live pickup points */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-hero-serif text-3xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-4xl">
            {t('pages.cityGuide.pickupHeading', { city: copy.name })}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">{t('pages.cityGuide.pickupIntro')}</p>

          {state.status === 'loading' && <LoadingState label={t('pages.cityGuide.loadingPoints')} />}

          {state.status === 'error' && (
            <p className="mt-6 max-w-xl border border-brand-navy/10 bg-white px-5 py-4 text-sm text-text-muted">{t('pages.cityGuide.pointsErrorBody')}</p>
          )}

          {state.status === 'loaded' && state.points.length === 0 && (
            <div className="mt-6 max-w-2xl border border-brand-gold/25 bg-white px-5 py-5">
              <p className="text-sm font-semibold text-brand-navy">{t('pages.cityGuide.noPointsTitle', { city: copy.name })}</p>
              <p className="mt-1 text-sm leading-6 text-text-muted">{t('pages.cityGuide.noPointsBody')}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <LinkButton to="/book" variant="primary" size="compact">
                  {t('pages.cityGuide.bookCta')}
                </LinkButton>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center border border-brand-navy/15 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-gold"
                >
                  {t('pages.cityGuide.contactCta')}
                </a>
              </div>
            </div>
          )}

          {state.status === 'loaded' && state.points.length > 0 && (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {TYPE_ORDER.filter((type) => state.points.some((p) => p.type === type)).map((type) => (
                <div key={type} className="border border-brand-gold/15 bg-white p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
                    <span aria-hidden="true">{TYPE_ICON[type]}</span>
                    {t(TYPE_HEADING_KEY[type])}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {state.points
                      .filter((p) => p.type === type)
                      .map((point) => (
                        <li key={point.id} className="flex items-baseline justify-between gap-3 border-t border-brand-navy/10 pt-2 text-sm first:border-t-0 first:pt-0">
                          <span className="text-brand-navy">{point.name}</span>
                          {point.airport_code && <span className="shrink-0 text-xs font-semibold tracking-wide text-brand-gold-dark">{point.airport_code}</span>}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="flex items-center gap-3 font-hero-serif text-3xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-4xl">
          <Compass className="h-6 w-6 shrink-0 text-brand-gold" aria-hidden="true" />
          {t('pages.cityGuide.highlightsHeading', { city: copy.name })}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {copy.highlights.map((item, index) => (
            <article key={item.title} className="border border-[#ece7df] bg-white p-5 transition-colors hover:border-brand-gold/40">
              <div className="flex h-9 w-9 items-center justify-center bg-brand-gold text-sm font-semibold text-white">{index + 1}</div>
              <h3 className="mt-4 text-lg font-semibold text-brand-navy">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Driving tips */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="flex items-center gap-3 font-hero-serif text-3xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-4xl">
            <Lightbulb className="h-6 w-6 shrink-0 text-brand-gold" aria-hidden="true" />
            {t('pages.cityGuide.tipsHeading', { city: copy.name })}
          </h2>
          <ul className="mt-6 space-y-3">
            {copy.drivingTips.map((tip) => (
              <li key={tip} className="flex gap-3 border border-brand-navy/10 bg-white px-4 py-3 text-sm leading-6 text-brand-navy/85">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-brand-gold" aria-hidden="true" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Blog articles about this city — links out to the guides and back. */}
      <RelatedGuides posts={guidePosts} heading={t('pages.blog.fromBlogHeading', { city: copy.name })} />

      {/* Other cities — internal links between the city pages. */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="font-hero-serif text-3xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-4xl">{t('pages.cityGuide.nearbyHeading')}</h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {otherGuides.map((other) => {
            const otherCopy = i18n.language === 'ar' ? other.ar : other.en
            const otherPhoto = CITY_PHOTOS[other.city]
            return (
              <li key={other.slug}>
                <Link
                  to={`/locations/${other.slug}`}
                  className="group block overflow-hidden border border-[#ece7df] bg-white transition-colors hover:border-brand-gold/50"
                >
                  {otherPhoto && <img src={otherPhoto.src} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />}
                  <span className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-brand-navy">
                    {otherCopy.name}
                    <ChevronRight className="h-4 w-4 shrink-0 text-brand-gold transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Closing CTA */}
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl border border-brand-gold-dark bg-white p-8 text-center sm:p-12">
          <h2 className="font-hero-serif text-3xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-4xl">
            {t('pages.cityGuide.ctaHeading', { city: copy.name })}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-muted sm:text-base">{t('pages.cityGuide.ctaBody')}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkButton to="/book" variant="primary">
              {t('pages.cityGuide.bookCta')}
            </LinkButton>
            <LinkButton to="/contact" variant="outline">
              {t('pages.cityGuide.contactCta')}
            </LinkButton>
          </div>
          <nav aria-label={t('pages.cityGuide.beforeYouBook')} className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-[#ece7df] pt-5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">{t('pages.cityGuide.beforeYouBook')}</span>
            <Link to="/car-types" className="font-medium text-brand-gold-dark hover:text-brand-gold">
              {t('footer.carTypes')}
            </Link>
            <Link to="/faqs" className="font-medium text-brand-gold-dark hover:text-brand-gold">
              {t('footer.faqs')}
            </Link>
            <Link to="/booking-terms" className="font-medium text-brand-gold-dark hover:text-brand-gold">
              {t('footer.bookingTerms')}
            </Link>
            <Link to="/blog" className="font-medium text-brand-gold-dark hover:text-brand-gold">
              {t('footer.blog')}
            </Link>
          </nav>
        </div>
      </section>
    </div>
  )
}
