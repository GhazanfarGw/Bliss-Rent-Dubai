import { CITY_GUIDES, findGuideBySlug, type CityGuide } from '@/features/content/cityGuides'
import { stripInline } from '@/features/blog/richText'
import { RENTAL_GUIDE_POSTS } from '@/features/blog/posts/rentalGuides'
import { CITY_GUIDE_POSTS } from '@/features/blog/posts/cityGuidePosts'
import { ROAD_TRIP_POSTS } from '@/features/blog/posts/roadTrips'
import { TRAVEL_TIP_POSTS } from '@/features/blog/posts/travelTips'

/**
 * The blog (/blog, /blog/category/:category, /blog/:slug). Articles are
 * plain data in the files under ./posts — no CMS, no database — so adding
 * one is: append an object to the right file, add its slug (and date) to
 * BLOG_ROUTES in scripts/generate-sitemap.mjs (a unit test fails until you
 * do), done. Every article has an English and an Arabic version.
 *
 * Writing rules (they keep the blog honest, which is also what ranks):
 *  - Facts about Bliss Rent come from what the site already says (FAQs,
 *    About, Locations). Anything the Booking Terms still leave blank
 *    (deposit, fuel, mileage, cancellation, minimum age) is NOT stated
 *    here — the article points to /booking-terms or /faqs instead.
 *  - Facts about the UAE stay to well-known, slow-changing ones; anything
 *    that changes (toll prices, opening hours, fees) is described, never
 *    quoted.
 *  - Link generously: `[label](/path)` inside any paragraph, list item or
 *    FAQ answer (see richText.tsx). A test checks every link resolves.
 */

export type BlogCategoryId = 'rental-guides' | 'city-guides' | 'road-trips' | 'travel-tips'

export interface BlogSection {
  heading: string
  paragraphs?: string[]
  list?: string[]
}

export interface BlogFaq {
  question: string
  answer: string
}

export interface BlogCopy {
  /** Article headline / <h1>. Keep it under ~47 characters so the tab title ("… — Bliss Rent") fits a search result. */
  title: string
  /** <meta name="description"> — one or two sentences, under ~160 characters. */
  description: string
  /** Short teaser shown on cards (one or two sentences). */
  excerpt: string
  /** Opening paragraph — answer the headline's question straight away. */
  intro: string
  sections: BlogSection[]
  faqs?: BlogFaq[]
}

export interface BlogPost {
  /** URL segment: /blog/<slug>. */
  slug: string
  category: BlogCategoryId
  /** Slug of the city page (/locations/<slug>) this article is mainly about — it links there and borrows its photo. */
  city?: string
  /** Other cities the article covers — it's also listed on their city pages, and its call-to-action links to them. */
  alsoCities?: string[]
  /** Don't show the main city's photo on the article — for when the city page's photo isn't what the article is about (e.g. Hatta's mountains vs. Dubai's skyline). */
  noCityPhoto?: boolean
  /** ISO date (YYYY-MM-DD). */
  publishedAt: string
  /** ISO date, only if the article was meaningfully revised later. */
  updatedAt?: string
  /** Slugs of articles to suggest next, before the automatic same-category ones. */
  related?: string[]
  en: BlogCopy
  ar: BlogCopy
}

export interface BlogCategory {
  id: BlogCategoryId
  en: { name: string; description: string }
  ar: { name: string; description: string }
}

export const BLOG_CATEGORIES: BlogCategory[] = [
  {
    id: 'rental-guides',
    en: {
      name: 'Car rental guides',
      description: 'How renting a car in the UAE works — documents, booking, rental periods, choosing the right car, and what Bliss Rent provides.',
    },
    ar: {
      name: 'أدلة تأجير السيارات',
      description: 'كيف يعمل تأجير السيارات في الإمارات — المستندات والحجز وفترات الإيجار واختيار السيارة المناسبة وما تقدمه بليس رنت.',
    },
  },
  {
    id: 'city-guides',
    en: {
      name: 'City guides',
      description: 'Where to go and how to get around the UAE’s cities with your own car — itineraries for Dubai, Abu Dhabi, Sharjah, Ajman and Umm Al Quwain.',
    },
    ar: {
      name: 'أدلة المدن',
      description: 'أين تذهب وكيف تتنقل في مدن الإمارات بسيارتك الخاصة — برامج لدبي وأبوظبي والشارقة وعجمان وأم القيوين.',
    },
  },
  {
    id: 'road-trips',
    en: {
      name: 'Road trips',
      description: 'Day trips and weekend drives from Dubai and Abu Dhabi — Hatta, Jebel Jais, the east coast and Al Ain.',
    },
    ar: {
      name: 'رحلات برية',
      description: 'رحلات ليوم واحد وعطلات نهاية الأسبوع بالسيارة من دبي وأبوظبي — حتا وجبل جيس والساحل الشرقي والعين.',
    },
  },
  {
    id: 'travel-tips',
    en: {
      name: 'Driving tips',
      description: 'Tolls, parking, fines and the rules of the road — what to know before your first drive in the UAE.',
    },
    ar: {
      name: 'نصائح القيادة',
      description: 'الرسوم والمواقف والمخالفات وقواعد الطريق — ما يجب معرفته قبل أول رحلة قيادة لك في الإمارات.',
    },
  },
]

/** Newest first; ties keep the order they're written in the post files (which is the order they appear in). */
export const BLOG_POSTS: BlogPost[] = [...RENTAL_GUIDE_POSTS, ...CITY_GUIDE_POSTS, ...ROAD_TRIP_POSTS, ...TRAVEL_TIP_POSTS]
  .map((post, order) => ({ post, order }))
  .sort((a, b) => b.post.publishedAt.localeCompare(a.post.publishedAt) || a.order - b.order)
  .map(({ post }) => post)

export function findPostBySlug(slug: string | undefined): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug)
}

export function findCategory(id: string | undefined): BlogCategory | undefined {
  return BLOG_CATEGORIES.find((category) => category.id === id)
}

export function postPath(slug: string): string {
  return `/blog/${slug}`
}

export function categoryPath(id: BlogCategoryId): string {
  return `/blog/category/${id}`
}

export function postsInCategory(id: BlogCategoryId): BlogPost[] {
  return BLOG_POSTS.filter((post) => post.category === id)
}

/** Articles mainly about one city (by its /locations/<slug>), for the city page's "From our blog" section. */
export function postsForCity(citySlug: string): BlogPost[] {
  return BLOG_POSTS.filter((post) => post.city === citySlug || post.alsoCities?.includes(citySlug))
}

export function postsBySlugs(slugs: string[]): BlogPost[] {
  return slugs.map((slug) => findPostBySlug(slug)).filter((post): post is BlogPost => post !== undefined)
}

/**
 * What to read next: the article's hand-picked `related` first, then others
 * from the same category, then anything about the same city — never the
 * article itself, never a repeat.
 */
export function relatedPosts(post: BlogPost, limit = 3): BlogPost[] {
  const picked = new Map<string, BlogPost>()
  const add = (candidate: BlogPost | undefined) => {
    if (candidate && candidate.slug !== post.slug && !picked.has(candidate.slug)) picked.set(candidate.slug, candidate)
  }
  for (const slug of post.related ?? []) add(findPostBySlug(slug))
  for (const candidate of BLOG_POSTS) if (candidate.category === post.category) add(candidate)
  for (const candidate of BLOG_POSTS) if (post.city && candidate.city === post.city) add(candidate)
  for (const candidate of BLOG_POSTS) add(candidate)
  return Array.from(picked.values()).slice(0, limit)
}

export function postCopy(post: BlogPost, language: string): BlogCopy {
  return language === 'ar' ? post.ar : post.en
}

export function categoryCopy(category: BlogCategory, language: string) {
  return language === 'ar' ? category.ar : category.en
}

export function postCity(post: BlogPost): CityGuide | undefined {
  return post.city ? findGuideBySlug(post.city) : undefined
}

/** The article's main city first, then any others it covers. */
export function postCities(post: BlogPost): CityGuide[] {
  return [post.city, ...(post.alsoCities ?? [])].map((slug) => findGuideBySlug(slug)).filter((guide): guide is CityGuide => guide !== undefined)
}

/** Roughly 200 words a minute, at least one. */
export function readingMinutes(copy: BlogCopy): number {
  const text = [
    copy.intro,
    ...copy.sections.flatMap((section) => [section.heading, ...(section.paragraphs ?? []), ...(section.list ?? [])]),
    ...(copy.faqs ?? []).flatMap((faq) => [faq.question, faq.answer]),
  ]
    .map(stripInline)
    .join(' ')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

/** Each city page slug → its display name (English), for tests and labels. */
export const CITY_SLUGS = CITY_GUIDES.map((guide) => guide.slug)
