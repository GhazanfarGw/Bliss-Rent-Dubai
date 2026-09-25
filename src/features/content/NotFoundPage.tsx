import { useTranslation } from 'react-i18next'
import { CarFront } from 'lucide-react'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { useDocumentTitle, useNoIndex } from '@/lib/useDocumentTitle'

/**
 * Catch-all for any URL that doesn't match a real route (typo, stale
 * link, removed page). Before this there was no `path="*"` route at all —
 * an unknown URL rendered a blank content area inside the header/footer
 * chrome, with no explanation and no way forward. Both links go to real
 * existing pages; nothing here invents a page or promises help that
 * doesn't exist.
 */
export function NotFoundPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('pages.notFound.title'))
  useNoIndex()

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-lavender">
        <CarFront className="h-8 w-8 text-brand-navy" aria-hidden="true" />
      </div>
      <p className="mt-6 text-sm font-semibold uppercase tracking-[0.28em] text-brand-gold-dark">404</p>
      <h1 className="font-hero-serif mt-3 text-3xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-4xl">
        {t('pages.notFound.title')}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-text-muted sm:text-base">{t('pages.notFound.body')}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <LinkButton to="/" variant="primary">
          {t('pages.notFound.backHome')}
        </LinkButton>
        <LinkButton to="/search" variant="outline">
          {t('pages.notFound.browseFleet')}
        </LinkButton>
      </div>
    </div>
  )
}
