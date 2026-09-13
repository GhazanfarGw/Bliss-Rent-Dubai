import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface FaqCategory { heading: string; items: { question: string; answer: string }[] }

/** Homepage FAQ preview reuses the canonical translated FAQ content. */
export function HomeFaqSection() {
  const { t } = useTranslation()
  const categories = t('pages.faqs.categories', { returnObjects: true }) as FaqCategory[]
  const items = categories.flatMap((category) => category.items).slice(0, 4)
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="bg-[radial-gradient(circle_at_top,_rgba(212,175,106,0.08),transparent_28%),var(--color-surface-warm)]">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold-dark">{t('home.faq.eyebrow')}</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-brand-navy sm:text-4xl">{t('home.faq.title')}</h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">{t('home.faq.subtitle')}</p>
          </div>
          <Link to="/faqs" className="text-sm font-semibold text-brand-navy underline-offset-4 hover:underline">{t('home.faq.viewAll')}</Link>
        </div>
        <div className="mt-8 divide-y divide-brand-navy/10 rounded-[1.5rem] border border-[#e7dcc7] bg-white shadow-[0_18px_36px_rgba(16,20,29,0.04)]">
          {items.map((item, index) => {
            const expanded = open === index
            return <div key={item.question}><button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : index)} className="group flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-start transition-colors duration-200 hover:bg-brand-lavender/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-gold"><span className="text-sm font-medium text-brand-navy transition-colors group-hover:text-brand-gold-dark">{item.question}</span><span className={'text-xl text-brand-gold transition-transform duration-300' + (expanded ? ' rotate-45' : '')} aria-hidden="true">+</span></button>{expanded && <p className="animate-faq-answer-in px-5 pb-5 text-sm leading-relaxed text-text-muted">{item.answer}</p>}</div>
          })}
        </div>
      </div>
    </section>
  )
}