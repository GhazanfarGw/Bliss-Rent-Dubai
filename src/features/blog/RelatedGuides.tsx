import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { PostCard } from '@/features/blog/PostCard'
import type { BlogPost } from '@/features/blog/blogPosts'

interface RelatedGuidesProps {
  posts: BlogPost[]
  heading: string
  subtitle?: string
  /** Show the "view all articles" link under the cards (default true). */
  showViewAll?: boolean
  /** No visual effect any more (the whole site is white); kept so existing callers still type-check. */
  tone?: 'plain' | 'alt'
}

/**
 * A row of blog article cards with a heading — the one piece the rest of
 * the site drops in to link to relevant guides (city pages, FAQs, car
 * types, the homepage…). Renders nothing when there are no posts, so a
 * caller never has to guard against an empty list.
 */
export function RelatedGuides({ posts, heading, subtitle, showViewAll = true }: RelatedGuidesProps) {
  const { t } = useTranslation()
  if (posts.length === 0) return null

  return (
    <section className="py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="font-hero-serif text-3xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-4xl">{heading}</h2>
            {subtitle && <p className="mt-2 text-sm leading-6 text-text-muted sm:text-base">{subtitle}</p>}
          </div>
          {showViewAll && (
            <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-gold-dark transition-colors hover:text-brand-gold">
              {t('pages.blog.viewAll')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          )}
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
