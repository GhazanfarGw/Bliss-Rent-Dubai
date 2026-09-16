import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/features/shared/ui/Button'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import {
  OFFICE_ADDRESS,
  OFFICE_MAPS_EMBED_URL,
  OFFICE_MAPS_URL,
  PHONE_URL,
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_HREF,
  WHATSAPP_PHONE_DISPLAY,
  WHATSAPP_URL,
} from '@/features/booking/contactLinks'
import heroSuv from '@/assets/hero/hero-suv.webp'

type FormState = { status: 'idle' | 'sending' | 'sent' }
type FaqItem = { question: string; answer: string }

/**
 * Contact Us — full premium redesign: real hero photography banner
 * (matching the About page's treatment), icon-badge method cards, a real
 * embedded map for the office address, and a closing booking CTA — the
 * same editorial system used across About/WhyChooseSection, applied
 * consistently here.
 *
 * Real-data changes alongside the visual redesign:
 *  - WhatsApp, phone, and email are real clickable links (wa.me / tel: /
 *    mailto:), reusing the single-source-of-truth constants from
 *    contactLinks.ts. Phone reuses the WhatsApp number — there's no
 *    separate landline — via the tel: link built in contactLinks.ts.
 *  - The office address placeholder is the real address, with both a
 *    "Get directions" link AND a live embedded map centered on it — no
 *    API key, no new backend call, just a plain maps.google.com iframe.
 *  - Support hours is now a real value (24/7) — the earlier bracketed
 *    placeholder is gone now that a real value exists.
 *
 * FAQ shortcut section: a small, curated set of the questions people most
 * often write in about (cancellations, documents, pickup/drop-off,
 * mileage), shown right on this page so a visitor can self-serve before
 * using the form — with a link through to the full FAQ page. Content
 * lives in pages.contact.faqShortcut in the locale files, matching the
 * canonical answers on the FAQ page rather than inventing new copy.
 *
 * Form submission logic (submit-complaint Edge Function, validation) is
 * unchanged from the Phase 9H implementation.
 */
export function ContactPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('pages.contact.title'))
  useMetaDescription(t('pages.contact.subtitle'))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [state, setState] = useState<FormState>({ status: 'idle' })
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const faqItems = t('pages.contact.faqShortcut.items', { returnObjects: true }) as FaqItem[]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!name.trim()) nextErrors.name = t('pages.contact.form.errorName')
    if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = t('pages.contact.form.errorEmail')
    if (!message.trim()) nextErrors.message = t('pages.contact.form.errorMessage')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setState({ status: 'sending' })
    try {
      const { error } = await supabase.functions.invoke('submit-complaint', {
        body: { fullName: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() },
      })
      if (error) throw error

      setState({ status: 'sent' })
      setName('')
      setEmail('')
      setSubject('')
      setMessage('')
    } catch {
      setState({ status: 'idle' })
      setErrors({ submit: t('pages.contact.form.errorSubmit') })
    }
  }

  return (
    <div>
      {/* Banner — same treatment as the redesigned About page, a fresh
          image (the SUV shot) so the two pages don't reuse one photo. */}
      <section className="relative isolate overflow-hidden bg-brand-navy">
        <img
          src={heroSuv}
          alt=""
          aria-hidden="true"
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/90 via-brand-navy/85 to-brand-navy" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-brand-champagne">{t('nav.contact')}</p>
          <h1 className="font-hero-serif mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{t('pages.contact.title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-brand-lavender sm:text-base">{t('pages.contact.subtitle')}</p>
        </div>
      </section>

      {/* Methods + form */}
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-5">
            {/* WhatsApp — a real wa.me link, not display-only text. */}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="group flex gap-4 border border-[#ece7df] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-(--shadow-card-hover)"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-brand-gold text-white">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('pages.contact.methods.whatsapp.label')}</p>
                <p className="mt-1 break-words font-mono text-sm font-semibold text-brand-navy group-hover:text-brand-gold-dark">
                  {WHATSAPP_PHONE_DISPLAY}
                </p>
                <p className="mt-1 text-xs text-text-muted">{t('pages.contact.methods.whatsapp.note')}</p>
              </div>
            </a>

            {/* Call us — a real tel: link, same number as WhatsApp. */}
            <a
              href={PHONE_URL}
              className="group flex gap-4 border border-[#ece7df] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-(--shadow-card-hover)"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-brand-navy text-white">
                <Phone className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('pages.contact.methods.phone.label')}</p>
                <p className="mt-1 break-words font-mono text-sm font-semibold text-brand-navy group-hover:text-brand-gold-dark">
                  {WHATSAPP_PHONE_DISPLAY}
                </p>
                <p className="mt-1 text-xs text-text-muted">{t('pages.contact.methods.phone.note')}</p>
              </div>
            </a>

            {/* Email — a real mailto: link. */}
            <a
              href={SUPPORT_EMAIL_HREF}
              className="group flex gap-4 border border-[#ece7df] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-(--shadow-card-hover)"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-brand-navy text-white">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('pages.contact.methods.email.label')}</p>
                <p className="mt-1 break-words font-mono text-sm font-semibold text-brand-navy group-hover:text-brand-gold-dark">
                  {SUPPORT_EMAIL}
                </p>
                <p className="mt-1 text-xs text-text-muted">{t('pages.contact.methods.email.note')}</p>
              </div>
            </a>

            {/* Support hours — real value (24/7), no longer a placeholder. */}
            <div className="flex gap-4 border border-[#ece7df] bg-white p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-brand-navy text-white">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('pages.contact.methods.hours.label')}</p>
                <p className="mt-1 break-words font-mono text-sm font-semibold text-brand-navy">{t('pages.contact.methods.hours.value')}</p>
              </div>
            </div>

            <p className="border border-brand-lavender bg-brand-lavender/30 px-4 py-3 text-xs text-text-muted">
              {t('pages.contact.supportNote')}
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="border border-[#ece7df] bg-white p-6 sm:p-7">
            <h2 className="text-base font-semibold text-brand-navy">{t('pages.contact.form.heading')}</h2>

            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t('pages.contact.form.name')}
                  </span>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoComplete="name" />
                  {errors.name && <p className="mt-1 text-xs text-error">{errors.name}</p>}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t('pages.contact.form.email')}
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    autoComplete="email"
                  />
                  {errors.email && <p className="mt-1 text-xs text-error">{errors.email}</p>}
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('pages.contact.form.subject')}
                </span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('pages.contact.form.message')}
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className={inputClass}
                />
                {errors.message && <p className="mt-1 text-xs text-error">{errors.message}</p>}
              </label>

              <Button type="submit" loading={state.status === 'sending'} fullWidthOnMobile className="w-full">
                {state.status === 'sending' ? t('pages.contact.form.sending') : t('pages.contact.form.submit')}
              </Button>

              {state.status === 'sent' && (
                <p className="border border-success/25 bg-success-bg px-4 py-3 text-sm text-success">
                  {t('pages.contact.form.success')}
                </p>
              )}
              {errors.submit && (
                <p className="border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{errors.submit}</p>
              )}
              <p className="text-xs text-text-muted">{t('pages.contact.form.note')}</p>
            </div>
          </form>
        </div>
      </div>

      {/* FAQ shortcut — a curated set of the questions people write in
          about most, so a visitor can self-serve before using the form
          above, with a link through to the full FAQ page. */}
      <section className="border-t border-[#ece7df] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold-dark">
                {t('pages.contact.faqShortcut.eyebrow')}
              </p>
              <h2 className="font-hero-serif mt-2 text-3xl font-semibold tracking-[-0.04em] text-brand-navy sm:text-4xl">
                {t('pages.contact.faqShortcut.heading')}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">{t('pages.contact.faqShortcut.subtitle')}</p>
            </div>
            <Link to="/faqs" className="text-sm font-semibold text-brand-navy underline-offset-4 hover:underline">
              {t('pages.contact.faqShortcut.viewAll')}
            </Link>
          </div>

          <div className="mt-8 divide-y divide-brand-navy/10 border border-[#ece7df]">
            {faqItems.map((item, index) => {
              const expanded = openFaq === index
              return (
                <div key={item.question}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpenFaq(expanded ? null : index)}
                    className="group flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-start transition-colors duration-200 hover:bg-brand-lavender/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-gold"
                  >
                    <span className="text-sm font-medium text-brand-navy transition-colors group-hover:text-brand-gold-dark">
                      {item.question}
                    </span>
                    <span
                      className={'text-xl text-brand-gold transition-transform duration-300' + (expanded ? ' rotate-45' : '')}
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </button>
                  {expanded && <p className="animate-faq-answer-in px-5 pb-5 text-sm leading-relaxed text-text-muted">{item.answer}</p>}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Visit our office — real address + a live embedded map, not just a link. */}
      <section className="bg-surface-warm-alt">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-5">
            <div className="border border-[#ece7df] bg-white p-7 lg:col-span-2">
              <span className="flex h-11 w-11 items-center justify-center bg-brand-navy text-white">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="font-hero-serif mt-5 text-3xl font-semibold tracking-[-0.04em] text-brand-navy sm:text-4xl">{t('pages.contact.visitOffice.heading')}</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-brand-navy">{OFFICE_ADDRESS}</p>
              <p className="mt-3 text-sm leading-6 text-text-muted">{t('pages.contact.visitOffice.subtitle')}</p>
              <a
                href={OFFICE_MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 bg-brand-gold px-5 py-2.75 text-sm font-semibold tracking-[0.02em] text-white shadow-none transition-all hover:brightness-105"
              >
                {t('pages.contact.getDirections')}
              </a>
            </div>

            <div className="overflow-hidden border border-[#ece7df] bg-white lg:col-span-3">
              <iframe
                title={t('pages.contact.visitOffice.heading')}
                src={OFFICE_MAPS_EMBED_URL}
                className="h-80 w-full lg:h-full lg:min-h-[22rem]"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA — same pattern as the redesigned About page. */}
      <section className="bg-brand-navy px-4 py-16 text-center sm:px-6">
        <h2 className="font-hero-serif text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{t('pages.contact.cta.heading')}</h2>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <LinkButton to="/book" variant="primary">
            {t('nav.searchCars')}
          </LinkButton>
          <Link
            to="/search"
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/70 bg-transparent px-5 py-2.75 text-sm font-semibold text-white transition-all hover:bg-white/10"
          >
            {t('hero.viewFleetCta')}
          </Link>
        </div>
      </section>
    </div>
  )
}

const inputClass =
  'w-full rounded-none border border-border bg-white px-3 py-2.5 text-sm text-brand-navy outline-none transition-colors focus:border-brand-navy focus:ring-1 focus:ring-brand-navy'
