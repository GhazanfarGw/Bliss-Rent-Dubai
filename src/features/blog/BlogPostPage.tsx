import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChevronRight, Clock, MapPin } from 'lucide-react'
import { CityLinks } from '@/features/blog/CityLinks'
import { InlineText, stripInline } from '@/features/blog/richText'
import { RelatedGuides } from '@/features/blog/RelatedGuides'
import {
  categoryCopy,
  categoryPath,
  findCategory,
  findPostBySlug,
  postCities,
  postCity,
  postCopy,
  postPath,
  readingMinutes,
  relatedPosts,
  type BlogPost,
} from '@/features/blog/blogPosts'
import { CITY_PHOTOS } from '@/features/booking/cityPhotos'
import { NotFoundPage } from '@/features/content/NotFoundPage'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { SITE_URL, useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import { useJsonLd } from '@/lib/useJsonLd'

/** One article (/blog/:slug). An unknown slug is a real 404. */
export function BlogPostPage() {
  const { slug } = useParams()
  const post = findPostBySlug(slug)
  if (!post) return <NotFoundPage />
  return <PostView post={post} />
}

function formatDate(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso))
}

function absoluteUrl(src: string): string {
  return src.startsWith('http') ? src : `${SITE_URL}${src.startsWith('/') ? '' : '/'}${src}`
}

function PostView({ post }: { post: BlogPost }) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const copy = postCopy(post, language)
  const category = findCategory(post.category)
  const categoryName = category ? categoryCopy(category, language).name : ''
  const city = postCity(post)
  const cityName = city ? (language === 'ar' ? city.ar.name : city.en.name) : undefined
  const photo = city && !post.noCityPhoto ? CITY_PHOTOS[city.city] : undefined
  const related = relatedPosts(post, 3)
  const cities = postCities(post)

  useDocumentTitle(copy.title)
  useMetaDescription(copy.description)

  const url = `${SITE_URL}${postPath(post.slug)}`
  useJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('nav.home'), item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: t('pages.blog.breadcrumbBlog'), item: `${SITE_URL}/blog` },
          ...(category ? [{ '@type': 'ListItem', position: 3, name: categoryName, item: `${SITE_URL}${categoryPath(category.id)}` }] : []),
          { '@type': 'ListItem', position: category ? 4 : 3, name: copy.title, item: url },
        ],
      },
      {
        '@type': 'BlogPosting',
        headline: copy.title,
        description: copy.description,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt ?? post.publishedAt,
        inLanguage: language,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        author: { '@type': 'Organization', name: 'Bliss Rent', url: SITE_URL },
        publisher: { '@type': 'Organization', name: 'Bliss Rent', url: SITE_URL },
        ...(category ? { articleSection: categoryName } : {}),
        ...(photo ? { image: absoluteUrl(photo.largeSrc) } : {}),
      },
      ...(copy.faqs && copy.faqs.length > 0
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: copy.faqs.map((faq) => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: { '@type': 'Answer', text: stripInline(faq.answer) },
              })),
            },
          ]
        : []),
    ],
  })

  return (
    <div className="bg-white text-brand-navy">
      <article>
        <header className="mx-auto max-w-3xl px-4 pb-6 pt-8 sm:px-6 lg:px-8 lg:pt-10">
          <nav aria-label={t('pages.blog.breadcrumbLabel')} className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
            <Link to="/" className="hover:text-brand-gold-dark">
              {t('nav.home')}
            </Link>
            <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
            <Link to="/blog" className="hover:text-brand-gold-dark">
              {t('pages.blog.breadcrumbBlog')}
            </Link>
            {category && (
              <>
                <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
                <Link to={categoryPath(category.id)} className="hover:text-brand-gold-dark">
                  {categoryName}
                </Link>
              </>
            )}
          </nav>

          {category && (
            <Link to={categoryPath(category.id)} className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold-dark hover:text-brand-gold">
              {categoryName}
            </Link>
          )}
          <h1 className="font-hero-serif mt-3 text-4xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-5xl">{copy.title}</h1>

          <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-muted">
            <span>{t('pages.blog.byTeam')}</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              <time dateTime={post.publishedAt}>{t('pages.blog.publishedOn', { date: formatDate(post.publishedAt, language) })}</time>
            </span>
            {post.updatedAt && (
              <span>
                <time dateTime={post.updatedAt}>{t('pages.blog.updatedOn', { date: formatDate(post.updatedAt, language) })}</time>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {t('pages.blog.readMinutes', { minutes: readingMinutes(copy) })}
            </span>
          </p>

          <p className="mt-6 text-lg leading-8 text-brand-navy/90">
            <InlineText text={copy.intro} />
          </p>
        </header>

        {photo && (
          <figure className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden border border-brand-gold/15 bg-brand-lavender shadow-(--shadow-card)">
              <img src={photo.largeSrc} alt={cityName ?? ''} loading="eager" className="aspect-[16/9] w-full object-cover" />
              {/* CC BY / CC BY-SA photo: author and license credit live with the photo. */}
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6 text-[10px] text-white/90">
                <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                  {t('pages.cityGuide.photoBy', { author: photo.author, license: photo.license })}
                </a>
              </figcaption>
            </div>
          </figure>
        )}

        <div className="mx-auto max-w-3xl px-4 pb-4 pt-8 sm:px-6 lg:px-8">
          {copy.sections.length > 2 && (
            <nav aria-label={t('pages.blog.inThisGuide')} className="mb-10 border border-[#ece7df] bg-white p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-gold-dark">{t('pages.blog.inThisGuide')}</p>
              <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-sm text-brand-navy/85 marker:text-brand-gold">
                {copy.sections.map((section, index) => (
                  <li key={section.heading}>
                    <a href={`#section-${index + 1}`} className="transition-colors hover:text-brand-gold-dark">
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="space-y-10">
            {copy.sections.map((section, index) => (
              <section key={section.heading} id={`section-${index + 1}`} className="scroll-mt-28">
                <h2 className="font-hero-serif text-2xl font-semibold tracking-[-0.05em] text-brand-navy sm:text-3xl">{section.heading}</h2>
                <div className="mt-4 space-y-4 text-base leading-8 text-brand-navy/85">
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph}>
                      <InlineText text={paragraph} />
                    </p>
                  ))}
                  {section.list && (
                    <ul className="space-y-2.5">
                      {section.list.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-3 h-1.5 w-1.5 shrink-0 bg-brand-gold" aria-hidden="true" />
                          <span>
                            <InlineText text={item} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </div>

          {copy.faqs && copy.faqs.length > 0 && (
            <section className="mt-12 border-t border-[#e5dfd6] pt-10" aria-labelledby="post-faq-heading">
              <h2 id="post-faq-heading" className="font-hero-serif text-2xl font-semibold tracking-[-0.05em] text-brand-navy sm:text-3xl">
                {t('pages.blog.faqHeading')}
              </h2>
              <div className="mt-5 space-y-4">
                {copy.faqs.map((faq) => (
                  <div key={faq.question} className="border border-[#ece7df] bg-white p-5">
                    <h3 className="text-base font-semibold text-brand-navy">{faq.question}</h3>
                    <p className="mt-2 text-sm leading-7 text-text-muted">
                      <InlineText text={faq.answer} />
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <aside className="mt-12 border border-brand-gold-dark bg-white p-7 text-center sm:p-9">
            <h2 className="font-hero-serif text-2xl font-semibold tracking-[-0.05em] text-brand-navy sm:text-3xl">{t('pages.blog.ctaHeading')}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-text-muted">{t('pages.blog.ctaBody')}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <LinkButton to="/search?mode=book" variant="primary">
                {t('pages.blog.bookCta')}
              </LinkButton>
              {cities.map((entry) => (
                <LinkButton key={entry.slug} to={`/locations/${entry.slug}`} variant="outline">
                  <MapPin className="me-2 h-4 w-4" aria-hidden="true" />
                  {t('pages.blog.cityCta', { city: language === 'ar' ? entry.ar.name : entry.en.name })}
                </LinkButton>
              ))}
              <LinkButton to="/contact" variant="outline">
                {t('pages.blog.contactCta')}
              </LinkButton>
            </div>
          </aside>
        </div>
      </article>

      <RelatedGuides posts={related} heading={t('pages.blog.relatedHeading')} tone="alt" />
      <CityLinks heading={t('pages.blog.exploreCitiesHeading')} body={t('pages.blog.exploreCitiesBody')} />
    </div>
  )
}
