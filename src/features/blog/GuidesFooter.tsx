import { useTranslation } from 'react-i18next'
import { RelatedGuides } from '@/features/blog/RelatedGuides'
import { postsBySlugs } from '@/features/blog/blogPosts'

/**
 * "Guides for your UAE trip" — a hand-picked row of articles, dropped
 * under a page's own content (homepage, FAQs, car types, locations,
 * about). Picking by slug rather than "latest" keeps each page pointing
 * at the articles that actually answer that page's reader's next question.
 */
export function GuidesFooter({ slugs, tone = 'alt' }: { slugs: string[]; tone?: 'plain' | 'alt' }) {
  const { t } = useTranslation()
  return <RelatedGuides posts={postsBySlugs(slugs)} heading={t('pages.blog.guidesHeading')} subtitle={t('pages.blog.guidesSubtitle')} tone={tone} />
}
