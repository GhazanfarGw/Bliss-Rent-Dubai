import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import {
  BLOG_POSTS,
  categoryCopy,
  findCategory,
  postCopy,
  postPath,
  readingMinutes,
  type BlogPost,
} from '@/features/blog/blogPosts'
import { postImage } from '@/features/blog/postImages'
import { Eyebrow } from '@/features/shared/ui/Eyebrow'
import { prefersReducedMotion } from '@/lib/motion'
import { scrollTrack } from '@/lib/scrollTrack'

/** How long a slide rests before the row moves on by itself. */
const AUTOPLAY_MS = 5000

/**
 * Newest first, then dealt out one category at a time (guides, city, road
 * trip, tip, guides, ...) so neighbouring slides differ in topic and picture.
 */
function slidesInOrder(posts: BlogPost[]): BlogPost[] {
  const newestFirst = [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const byCategory = new Map<string, BlogPost[]>()
  for (const post of newestFirst) byCategory.set(post.category, [...(byCategory.get(post.category) ?? []), post])
  const lists = [...byCategory.values()]
  const ordered: BlogPost[] = []
  for (let round = 0; ordered.length < newestFirst.length; round++) {
    for (const list of lists) if (list[round]) ordered.push(list[round])
  }
  return ordered
}

const SLIDES = slidesInOrder(BLOG_POSTS)

/**
 * The homepage blog slider: every article as a card with its picture, sliding
 * along on its own (paused while the pointer or keyboard focus is on it, and
 * not at all for visitors who prefer reduced motion) with previous/next
 * buttons and swipe/scroll for manual control.
 */
export function HomeBlogSliderSection() {
  const { t } = useTranslation()
  const trackRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const timer = window.setInterval(() => {
      if (!pausedRef.current) scrollTrack(trackRef.current, 1)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <section className="bg-white py-8 sm:py-12 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <Eyebrow>{t('home.blogSlider.eyebrow')}</Eyebrow>
            <h2 className="font-hero-serif mt-3 text-2xl font-semibold leading-[1.02] tracking-[-0.055em] text-brand-navy sm:text-3xl md:text-4xl">
              {t('home.blogSlider.title')}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted sm:mt-4 sm:text-base sm:leading-7">{t('home.blogSlider.subtitle')}</p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/blog"
              className="me-2 inline-flex min-h-11 items-center gap-2 border-b-2 border-brand-gold pb-1 text-sm font-semibold text-brand-navy transition-colors hover:text-brand-gold-dark"
            >
              {t('pages.blog.viewAll')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => scrollTrack(trackRef.current, -1)}
              aria-label={t('home.blogSlider.previous')}
              className="flex h-11 w-11 items-center justify-center border border-brand-gold/30 bg-white text-brand-navy transition-colors hover:bg-brand-gold hover:text-white"
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollTrack(trackRef.current, 1)}
              aria-label={t('home.blogSlider.next')}
              className="flex h-11 w-11 items-center justify-center bg-brand-gold text-white transition-colors hover:bg-brand-gold-dark"
            >
              <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          role="region"
          aria-roledescription="carousel"
          aria-label={t('home.blogSlider.carouselLabel')}
          onPointerEnter={() => (pausedRef.current = true)}
          onPointerLeave={() => (pausedRef.current = false)}
          onFocusCapture={() => (pausedRef.current = true)}
          onBlurCapture={() => (pausedRef.current = false)}
          className="mt-6 sm:mt-8"
        >
          {/* The row is padded (and pulled back out by the same amount) so the
              cards' shadows aren't cut off by the scroll container's edges. */}
          <div
            ref={trackRef}
            className="-mx-3 -mb-12 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-3 pb-16 pt-1 scroll-px-3"
          >
            {SLIDES.map((post, index) => (
              <BlogSlide key={post.slug} post={post} position={index + 1} total={SLIDES.length} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function BlogSlide({ post, position, total }: { post: BlogPost; position: number; total: number }) {
  const { t, i18n } = useTranslation()
  const copy = postCopy(post, i18n.language)
  const category = findCategory(post.category)
  const image = postImage(post)

  return (
    <article
      role="group"
      aria-roledescription="slide"
      aria-label={`${position} / ${total}`}
      className="white-box group relative flex w-[82%] shrink-0 snap-start flex-col overflow-hidden transition-colors hover:border-brand-gold/50 sm:w-[calc(50%-0.5rem)] lg:w-[calc(25%-0.75rem)]"
    >
      <div className="relative aspect-16/10 overflow-hidden bg-surface-warm">
        <img
          src={image.src}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        {category && (
          <span className="absolute start-3 top-3 bg-white/95 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-brand-gold-dark">
            {categoryCopy(category, i18n.language).name}
          </span>
        )}
        {image.credit && (
          <span className="absolute bottom-2 end-2 max-w-[calc(100%-1rem)] truncate bg-white/90 px-2 py-0.5 text-[9px] font-medium text-text-muted">
            {t('pages.cityGuide.photoBy', { author: image.credit.author, license: image.credit.license })}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-hero-serif text-xl font-semibold leading-snug tracking-[-0.04em] text-brand-navy">
          <Link to={postPath(post.slug)} className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold">
            {copy.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-text-muted">{copy.excerpt}</p>
        <p className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('pages.blog.readMinutes', { minutes: readingMinutes(copy) })}
          </span>
          <ArrowRight
            className="h-4 w-4 text-brand-gold transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
        </p>
      </div>
    </article>
  )
}
