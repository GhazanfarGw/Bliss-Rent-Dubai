import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronRight } from 'lucide-react'
import { CityLinks } from '@/features/blog/CityLinks'
import { PostCard } from '@/features/blog/PostCard'
import {
  BLOG_CATEGORIES,
  BLOG_POSTS,
  categoryCopy,
  categoryPath,
  findCategory,
  postCopy,
  postPath,
  postsInCategory,
  type BlogCategory,
} from '@/features/blog/blogPosts'
import { NotFoundPage } from '@/features/content/NotFoundPage'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { SITE_URL, useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import { useJsonLd } from '@/lib/useJsonLd'

/**
 * The blog's front door (/blog) and its category pages
 * (/blog/category/:category) — one component, since a category page is the
 * same list narrowed down. An unknown category is a real 404.
 */
export function BlogIndexPage() {
  const { category: categoryId } = useParams()
  const category = categoryId ? findCategory(categoryId) : undefined
  if (categoryId && !category) return <NotFoundPage />
  return <BlogIndexView category={category} />
}

function BlogIndexView({ category }: { category?: BlogCategory }) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const posts = category ? postsInCategory(category.id) : BLOG_POSTS
  const categoryText = category ? categoryCopy(category, language) : undefined

  const title = categoryText ? t('pages.blog.categoryTitle', { category: categoryText.name }) : t('pages.blog.metaTitle')
  const description = categoryText ? categoryText.description : t('pages.blog.metaDescription')
  useDocumentTitle(title)
  useMetaDescription(description)

  const pageUrl = category ? `${SITE_URL}${categoryPath(category.id)}` : `${SITE_URL}/blog`
  const breadcrumb = [
    { name: t('nav.home'), item: `${SITE_URL}/` },
    { name: t('pages.blog.breadcrumbBlog'), item: `${SITE_URL}/blog` },
    ...(categoryText ? [{ name: categoryText.name, item: pageUrl }] : []),
  ]
  useJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumb.map((entry, index) => ({ '@type': 'ListItem', position: index + 1, name: entry.name, item: entry.item })),
      },
      {
        '@type': category ? 'CollectionPage' : 'Blog',
        name: categoryText ? categoryText.name : t('pages.blog.heading'),
        description,
        url: pageUrl,
        inLanguage: language,
        blogPost: posts.map((post) => ({ '@type': 'BlogPosting', headline: postCopy(post, language).title, url: `${SITE_URL}${postPath(post.slug)}` })),
      },
    ],
  })

  return (
    <div className="bg-white text-brand-navy">
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <nav aria-label={t('pages.blog.breadcrumbLabel')} className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
          <Link to="/" className="hover:text-brand-gold-dark">
            {t('nav.home')}
          </Link>
          <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
          {category ? (
            <>
              <Link to="/blog" className="hover:text-brand-gold-dark">
                {t('pages.blog.breadcrumbBlog')}
              </Link>
              <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
              <span aria-current="page" className="font-semibold text-brand-navy">
                {categoryText?.name}
              </span>
            </>
          ) : (
            <span aria-current="page" className="font-semibold text-brand-navy">
              {t('pages.blog.breadcrumbBlog')}
            </span>
          )}
        </nav>

        <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold-dark">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          {category ? t('pages.blog.categoryEyebrow') : t('pages.blog.eyebrow')}
        </p>
        <h1 className="font-hero-serif mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-5xl">
          {categoryText ? categoryText.name : t('pages.blog.heading')}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-text-muted">{categoryText ? categoryText.description : t('pages.blog.subtitle')}</p>

        <nav aria-label={t('pages.blog.categoriesLabel')} className="mt-8">
          <ul className="flex flex-wrap gap-2">
            <li>
              <CategoryChip to="/blog" active={!category}>
                {t('pages.blog.allArticles')}
              </CategoryChip>
            </li>
            {BLOG_CATEGORIES.map((entry) => (
              <li key={entry.id}>
                <CategoryChip to={categoryPath(entry.id)} active={entry.id === category?.id}>
                  {categoryCopy(entry, language).name}
                </CategoryChip>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
        {posts.length === 0 ? (
          <p className="border border-brand-navy/10 bg-white px-5 py-4 text-sm text-text-muted">{t('pages.blog.emptyCategory')}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.slug}>
                <PostCard post={post} headingLevel="h2" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="bg-white">
        <CityLinks heading={t('pages.blog.exploreCitiesHeading')} body={t('pages.blog.exploreCitiesBody')} />
      </div>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl border border-brand-gold-dark bg-white p-8 text-center sm:p-12">
          <h2 className="font-hero-serif text-3xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-4xl">{t('pages.blog.ctaHeading')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-muted sm:text-base">{t('pages.blog.ctaBody')}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkButton to="/book" variant="primary">
              {t('pages.blog.bookCta')}
            </LinkButton>
            <LinkButton to="/search" variant="outline">
              {t('pages.blog.browseFleetCta')}
            </LinkButton>
          </div>
        </div>
      </section>
    </div>
  )
}

function CategoryChip({ to, active, children }: { to: string; active: boolean; children: string }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={
        'inline-flex items-center border px-4 py-2 text-sm font-semibold transition-colors ' +
        (active ? 'border-brand-gold bg-brand-gold text-white' : 'border-[#e5dfd6] bg-white text-brand-navy hover:border-brand-gold hover:text-brand-gold-dark')
      }
    >
      {children}
    </Link>
  )
}
