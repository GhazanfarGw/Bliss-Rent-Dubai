import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { SectionHeader } from '@/features/shared/ui/SectionHeader'

interface FaqItem {
  question: string
  answer: string
}

interface FaqCategory {
  heading: string
  items: FaqItem[]
}

/**
 * Accordion FAQ page. Every answer restates a fact already established
 * elsewhere in the app (18+ driver age from checkout validation, self-drive
 * only, Dubai-only coverage, guest checkout, rental terms) — nothing here
 * invents a policy; questions about a still-placeholder rule (mileage,
 * fuel, cancellation) point to the Booking Terms page instead of guessing
 * a number.
 */
export function FaqPage() {
  const { t } = useTranslation()
  const categories = t('pages.faqs.categories', { returnObjects: true }) as FaqCategory[]
  const [openKey, setOpenKey] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <SectionHeader title={t('pages.faqs.title')} description={t('pages.faqs.subtitle')} />

      <div className="mt-8 space-y-8">
        {categories.map((category) => (
          <section key={category.heading}>
            <h2 className="text-base font-semibold text-brand-navy">{category.heading}</h2>
            <div className="mt-3 divide-y divide-brand-navy/10 rounded-2xl border border-brand-navy/10 bg-white">
              {category.items.map((item) => {
                const key = `${category.heading}__${item.question}`
                const isOpen = openKey === key
                return (
                  <div key={key}>
                    <button
                      type="button"
                      onClick={() => setOpenKey(isOpen ? null : key)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left rtl:text-right"
                    >
                      <span className="text-sm font-medium text-brand-navy">{item.question}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-brand-gold-dark transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                    {isOpen && <p className="px-5 pb-4 text-sm leading-relaxed text-text-muted">{item.answer}</p>}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
