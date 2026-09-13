import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Search } from 'lucide-react'
import { SectionHeader } from '@/features/shared/ui/SectionHeader'
import { StateMessage } from '@/features/shared/StateMessage'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'

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
 *
 * The search box below is pure client-side filtering over this same
 * fixed, real content — it narrows what's shown, it never generates or
 * looks up new answers.
 */
export function FaqPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('pages.faqs.title'))
  useMetaDescription(t('pages.faqs.subtitle'))
  const categories = t('pages.faqs.categories', { returnObjects: true }) as FaqCategory[]
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter(
          (item) => item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q),
        ),
      }))
      .filter((category) => category.items.length > 0)
  }, [categories, query])

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <SectionHeader title={t('pages.faqs.title')} description={t('pages.faqs.subtitle')} />

      <div className="relative mt-8">
        <Search className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('pages.faqs.searchPlaceholder')}
          aria-label={t('pages.faqs.searchPlaceholder')}
          className="w-full rounded-none border border-brand-navy/15 bg-white py-3 ps-10 pe-4 text-sm text-brand-navy outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/25"
        />
      </div>

      {query.trim() && filteredCategories.length === 0 ? (
        <div className="mt-8">
          <StateMessage title={t('pages.faqs.noResultsTitle')} body={t('pages.faqs.noResultsBody')} />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {filteredCategories.map((category) => (
            <section key={category.heading}>
              <h2 className="text-base font-semibold text-brand-navy">{category.heading}</h2>
              <div className="mt-3 divide-y divide-brand-navy/10 rounded-none border border-brand-navy/10 bg-white">
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
      )}

      <div className="mt-10 border-t border-brand-navy/10 pt-8 text-center">
        <p className="text-sm text-text-muted">{t('pages.faqs.stillHaveQuestions')}</p>
        <Link
          to="/contact"
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-none bg-brand-gold px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold-light"
        >
          {t('pages.faqs.contactCta')}
        </Link>
      </div>
    </div>
  )
}
