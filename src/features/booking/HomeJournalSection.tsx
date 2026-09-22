import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Clock3 } from 'lucide-react'
import {
  categoryCopy,
  findCategory,
  postCopy,
  postPath,
  postsBySlugs,
  readingMinutes,
  type BlogPost,
} from '@/features/blog/blogPosts'
import { Eyebrow } from '@/features/shared/ui/Eyebrow'
import dubaiDrive from '@/assets/home/dubai-drive.jpg'
import sharjahDrive from '@/assets/home/sharjah-drive.jpg'
import abuDhabiDrive from '@/assets/home/abu-dhabi-drive.jpg'

const STORIES = [
  { slug: 'car-rental-dubai-complete-guide', image: dubaiDrive, altKey: 'home.journal.images.dubaiAlt' },
  { slug: 'sharjah-and-ajman-by-car', image: sharjahDrive, altKey: 'home.journal.images.sharjahAlt' },
  { slug: 'dubai-to-abu-dhabi-road-trip', image: abuDhabiDrive, altKey: 'home.journal.images.abuDhabiAlt' },
] as const

const POSTS_BY_SLUG = new Map(postsBySlugs(STORIES.map((story) => story.slug)).map((post) => [post.slug, post]))

export function HomeJournalSection() {
  const { t, i18n } = useTranslation()

  return (
    <section className="bg-white py-8 sm:py-12 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
          <div>
            <Eyebrow>{t('home.journal.eyebrow')}</Eyebrow>
            <h2 className="font-hero-serif mt-3 max-w-2xl text-2xl font-semibold leading-tight tracking-[-0.055em] text-brand-navy sm:text-3xl md:text-4xl">
              {t('home.journal.title')}
            </h2>
          </div>
          <div className="lg:justify-self-end lg:text-end">
            <p className="max-w-2xl text-sm leading-6 text-text-muted sm:text-base sm:leading-7">{t('home.journal.subtitle')}</p>
            <Link
              to="/blog"
              className="mt-4 inline-flex min-h-11 items-center gap-2 border-b-2 border-brand-gold pb-1 text-sm font-semibold text-brand-navy transition-colors hover:text-brand-gold-dark"
            >
              {t('pages.blog.viewAll')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="-mx-4 mt-6 flex sm:mt-8 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:grid-rows-2 lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0">
          {STORIES.map((story, index) => {
            const post = POSTS_BY_SLUG.get(story.slug)
            if (!post) return null
            return (
              <StoryCard
                key={story.slug}
                post={post}
                image={story.image}
                imageAlt={t(story.altKey)}
                language={i18n.language}
                featured={index === 0}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

function StoryCard({
  post,
  image,
  imageAlt,
  language,
  featured,
}: {
  post: BlogPost
  image: string
  imageAlt: string
  language: string
  featured: boolean
}) {
  const { t } = useTranslation()
  const copy = postCopy(post, language)
  const category = findCategory(post.category)

  return (
    <article
      className={
        'group min-w-[82vw] snap-start overflow-hidden border border-[#e4dbd0] bg-white shadow-[0_18px_45px_rgba(72,54,43,0.08)] sm:min-w-[60vw] lg:min-w-0 ' +
        (featured ? 'lg:row-span-2' : '')
      }
    >
      <Link to={postPath(post.slug)} className="flex h-full flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold">
        <div className={'relative overflow-hidden bg-[#eee6dc] ' + (featured ? 'h-52 sm:h-72 lg:h-[29rem]' : 'h-52 lg:h-48')}>
          <img
            src={image}
            alt={imageAlt}
            loading={featured ? 'eager' : 'lazy'}
            fetchPriority={featured ? 'low' : undefined}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
          />
          <span className="absolute end-4 top-4 bg-white/92 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-brand-gold-dark backdrop-blur-sm">
            {t('home.journal.latestLabel')}
          </span>
        </div>

        <div className={'flex flex-1 flex-col p-5 sm:p-6 ' + (featured ? 'bg-brand-gold text-white lg:p-8' : 'bg-white text-brand-navy')}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[0.18em]">
            <span className={featured ? 'text-brand-champagne' : 'text-brand-gold-dark'}>
              {category ? categoryCopy(category, language).name : t('home.journal.eyebrow')}
            </span>
            <span className={'inline-flex items-center gap-1 ' + (featured ? 'text-white/60' : 'text-text-muted')}>
              <Clock3 className="h-3 w-3" aria-hidden="true" />
              {t('pages.blog.readMinutes', { minutes: readingMinutes(copy) })}
            </span>
          </div>
          <h3 className={'font-hero-serif mt-3 font-semibold leading-tight tracking-[-0.045em] ' + (featured ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-2xl')}>
            {copy.title}
          </h3>
          <p className={'mt-3 hidden text-sm leading-6 sm:block ' + (featured ? 'text-white/75' : 'text-text-muted')}>{copy.excerpt}</p>
          <span className={'mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] ' + (featured ? 'text-white' : 'text-brand-gold-dark')}>
            {t('home.journal.readStory')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </article>
  )
}
