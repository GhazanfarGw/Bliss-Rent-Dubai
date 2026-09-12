import { useTranslation } from 'react-i18next'
import { LegalPage } from '@/features/content/LegalPage'

interface Section {
  heading: string
  paragraphs?: string[]
  list?: string[]
}

export function BookingTermsPage() {
  const { t } = useTranslation()
  const sections = t('pages.bookingTerms.sections', { returnObjects: true }) as Section[]

  return (
    <LegalPage
      title={t('pages.bookingTerms.title')}
      updated={t('pages.bookingTerms.updated')}
      draftNotice={t('pages.bookingTerms.draftNotice')}
      intro={t('pages.bookingTerms.intro')}
      sections={sections}
    />
  )
}
