import { useTranslation } from 'react-i18next'
import { LegalPage } from '@/features/content/LegalPage'

interface Section {
  heading: string
  paragraphs?: string[]
  list?: string[]
}

export function CookiePolicyPage() {
  const { t } = useTranslation()
  const sections = t('pages.cookiePolicy.sections', { returnObjects: true }) as Section[]

  return (
    <LegalPage
      title={t('pages.cookiePolicy.title')}
      updated={t('pages.cookiePolicy.updated')}
      draftNotice={t('pages.cookiePolicy.draftNotice')}
      sections={sections}
    />
  )
}
