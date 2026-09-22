import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { categoryCopy, findCategory, postCopy, postPath, readingMinutes, type BlogPost } from '@/features/blog/blogPosts'

/**
 * A blog article teaser. The whole card is one link (the title's link is
 * stretched over it), so there's a single, descriptive link per card for
 * screen readers and crawlers rather than three links to the same page.
 */
export function PostCard({ post, headingLevel = 'h3' }: { post: BlogPost; headingLevel?: 'h2' | 'h3' }) {
  const { t, i18n } = useTranslation()
  const copy = postCopy(post, i18n.language)
  const category = findCategory(post.category)
  const Heading = headingLevel

  return (
    <article className="group relative flex h-full flex-col border border-[#ece7df] bg-white p-5 transition-colors hover:border-brand-gold/50">
      {category && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-gold-dark">{categoryCopy(category, i18n.language).name}</p>
      )}
      <Heading className="font-hero-serif mt-3 text-xl font-semibold leading-snug tracking-[-0.04em] text-brand-navy">
        <Link to={postPath(post.slug)} className="after:absolute after:inset-0">
          {copy.title}
        </Link>
      </Heading>
      <p className="mt-2 flex-1 text-sm leading-6 text-text-muted">{copy.excerpt}</p>
      <p className="mt-4 flex items-center justify-between gap-3 text-xs text-text-muted">
        <span>{t('pages.blog.readMinutes', { minutes: readingMinutes(copy) })}</span>
        <ArrowRight className="h-4 w-4 text-brand-gold transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
      </p>
    </article>
  )
}
