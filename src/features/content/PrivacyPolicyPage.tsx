import { useTranslation } from 'react-i18next'
import { LegalPage } from '@/features/content/LegalPage'

interface Section {
  heading: string
  paragraphs?: string[]
  list?: string[]
}

export function PrivacyPolicyPage() {
  const { t } = useTranslation()
  const sections = t('pages.privacyPolicy.sections', { returnObjects: true }) as Section[]

  return (
    <LegalPage
      title={t('pages.privacyPolicy.title')}
      updated={t('pages.privacyPolicy.updated')}
      draftNotice={t('pages.privacyPolicy.draftNotice')}
      sections={sections}
    />
  )
}
