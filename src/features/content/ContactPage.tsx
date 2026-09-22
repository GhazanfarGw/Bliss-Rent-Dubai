import { useState, type FormEvent, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/features/shared/ui/Button'
import { ClosingCta } from '@/features/shared/ui/ClosingCta'
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
import contactAirportConcierge from '@/assets/contact/airport-concierge.jpg'
import contactGuestRelations from '@/assets/contact/guest-relations.jpg'

type FormState = { status: 'idle' | 'sending' | 'sent' }
type FaqItem = { question: string; answer: string }

export function ContactPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('pages.contact.title'))
  useMetaDescription(t('pages.contact.subtitle'))
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const faqItems = t('pages.contact.faqShortcut.items', { returnObjects: true }) as FaqItem[]

  return (
    <div className="bg-white text-brand-navy">
      <section className="relative isolate -mt-[var(--header-h)] overflow-hidden bg-white">
        <div className="pointer-events-none absolute -end-24 top-10 h-72 w-72 rounded-full border border-brand-champagne/35" aria-hidden="true" />
        <div className="pointer-events-none absolute -end-2 top-32 h-44 w-44 rounded-full border border-brand-gold/15" aria-hidden="true" />
        <div className="pointer-events-none absolute -start-16 bottom-[-7rem] h-56 w-56 rounded-full bg-brand-gold/5" aria-hidden="true" />

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-[calc(var(--header-h)+3.5rem)] sm:px-6 sm:pb-16 sm:pt-[calc(var(--header-h)+4.5rem)] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-center lg:gap-12 lg:px-8">
          <div className="max-w-3xl">
            <p className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.34em] text-brand-gold-dark">
              <span className="h-px w-8 bg-brand-champagne" aria-hidden="true" />
              {t('pages.contact.eyebrow')}
            </p>
            <h1 className="font-hero-serif mt-5 text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-brand-navy sm:text-5xl lg:text-6xl">
              {t('pages.contact.title')}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-text-muted sm:text-lg sm:leading-8">{t('pages.contact.subtitle')}</p>

            <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-brand-gold-dark lg:hidden">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span>
                {t('pages.contact.methods.hours.label')} · {t('pages.contact.methods.hours.value')}
              </span>
            </div>

            <div className="mt-8 hidden flex-col gap-3 md:flex md:flex-row">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 bg-brand-gold px-6 text-sm font-semibold text-white transition-all hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {t('pages.contact.methods.whatsapp.label')}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href={SUPPORT_EMAIL_HREF}
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-brand-gold/35 bg-white px-6 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-gold hover:text-brand-gold-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
              >
                <Mail className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                {t('pages.contact.methods.email.label')}
              </a>
            </div>
          </div>

          <figure className="relative min-h-52 overflow-hidden border border-white/70 bg-white shadow-[0_28px_80px_rgba(72,54,43,0.16)] sm:min-h-80 lg:min-h-[31rem]">
            <img
              src={contactAirportConcierge}
              alt={t('pages.contact.heroImageAlt')}
              loading="eager"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover object-[64%_center] lg:object-[68%_center]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/5" aria-hidden="true" />
            <div className="absolute inset-x-5 bottom-5 hidden max-w-sm items-center gap-4 border-s-4 border-brand-gold bg-white/95 p-4 shadow-[0_18px_50px_rgba(16,20,29,0.16)] backdrop-blur-sm lg:flex">
              <span className="grid h-11 w-11 shrink-0 place-items-center bg-brand-gold/10 text-brand-gold">
                <Headphones className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold-dark">{t('pages.contact.methods.hours.label')}</p>
                <p className="mt-1 text-sm font-semibold text-brand-navy">
                  {t('pages.contact.methods.hours.value')} · {t('pages.contact.methods.hours.note')}
                </p>
              </div>
            </div>
            <div className="pointer-events-none absolute end-0 top-0 h-1 w-32 bg-brand-gold" aria-hidden="true" />
          </figure>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-9 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <QuickContactCard
            href={WHATSAPP_URL}
            external
            icon={MessageCircle}
            label={t('pages.contact.methods.whatsapp.label')}
            value={WHATSAPP_PHONE_DISPLAY}
          />
          <QuickContactCard
            href={PHONE_URL}
            icon={Phone}
            label={t('pages.contact.methods.phone.label')}
            value={WHATSAPP_PHONE_DISPLAY}
          />
          <QuickContactCard
            href={SUPPORT_EMAIL_HREF}
            icon={Mail}
            label={t('pages.contact.methods.email.label')}
            value={SUPPORT_EMAIL}
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 pt-2 sm:px-6 sm:pb-20 sm:pt-5 lg:px-8 lg:pt-8">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:gap-10">
          <ContactForm />

          <div className="hidden space-y-4 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:block">
            <figure className="overflow-hidden border border-[#e1d8ce] bg-white shadow-[0_18px_50px_rgba(72,54,43,0.08)]">
              <img
                src={contactGuestRelations}
                alt={t('pages.contact.supportImageAlt')}
                loading="lazy"
                className="h-64 w-full object-cover object-center"
              />
              <figcaption className="bg-brand-gold p-5 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-champagne">{t('pages.contact.supportPanel.eyebrow')}</p>
                <p className="font-hero-serif mt-2 text-2xl font-semibold leading-tight tracking-[-0.035em]">{t('pages.contact.supportPanel.heading')}</p>
                <p className="mt-2 text-xs leading-5 text-white/80">{t('pages.contact.supportPanel.body')}</p>
              </figcaption>
            </figure>

            <div className="border border-[#e5ddd2] bg-white p-5">
              <div className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center bg-brand-gold/10 text-brand-gold">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold-dark">{t('pages.contact.methods.hours.label')}</p>
                  <p className="font-hero-serif mt-1 text-2xl font-semibold text-brand-navy">{t('pages.contact.methods.hours.value')}</p>
                  <p className="mt-1 text-xs leading-5 text-text-muted">{t('pages.contact.methods.hours.note')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.28fr)] lg:gap-14 lg:px-8 lg:py-20">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-brand-gold-dark">
              {t('pages.contact.faqShortcut.eyebrow')}
            </p>
            <h2 className="font-hero-serif mt-3 text-3xl font-semibold leading-tight tracking-[-0.045em] text-brand-navy sm:text-4xl">
              {t('pages.contact.faqShortcut.heading')}
            </h2>
            <p className="mt-4 text-sm leading-6 text-text-muted">{t('pages.contact.faqShortcut.subtitle')}</p>
            <Link
              to="/faqs"
              className="mt-7 inline-flex min-h-11 items-center gap-2 border-b-2 border-brand-gold pb-1 text-sm font-semibold text-brand-navy transition-colors hover:text-brand-gold-dark"
            >
              {t('pages.contact.faqShortcut.viewAll')}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="border-t border-[#ded6cc]">
            {faqItems.map((item, index) => {
              const expanded = openFaq === index
              return (
                <div key={item.question} className="border-b border-[#ded6cc]">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpenFaq(expanded ? null : index)}
                    className="group flex min-h-18 w-full items-center justify-between gap-5 py-5 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                  >
                    <span className="text-sm font-semibold leading-6 text-brand-navy transition-colors group-hover:text-brand-gold-dark sm:text-base">
                      {item.question}
                    </span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center border border-brand-gold/25 bg-[#faf6f0] text-brand-gold transition-colors group-hover:border-brand-gold">
                      <ChevronDown className={'h-4 w-4 transition-transform duration-200 ' + (expanded ? 'rotate-180' : '')} aria-hidden="true" />
                    </span>
                  </button>
                  {expanded && <p className="animate-faq-answer-in max-w-2xl pb-6 pe-12 text-sm leading-7 text-text-muted">{item.answer}</p>}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="grid overflow-hidden border border-[#ddd2c5] bg-white lg:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)]">
            <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
              <div>
                <span className="grid h-12 w-12 place-items-center bg-brand-gold text-white">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="font-hero-serif mt-6 text-3xl font-semibold tracking-[-0.045em] text-brand-navy sm:text-4xl">
                  {t('pages.contact.visitOffice.heading')}
                </h2>
                <p className="mt-5 text-sm font-semibold leading-6 text-brand-navy">{OFFICE_ADDRESS}</p>
                <p className="mt-3 text-sm leading-6 text-text-muted">{t('pages.contact.visitOffice.subtitle')}</p>
              </div>
              <a
                href={OFFICE_MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-brand-gold px-5 text-sm font-semibold text-white transition-all hover:brightness-105 sm:w-fit"
              >
                {t('pages.contact.getDirections')}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <div className="relative hidden min-h-[29rem] border-s border-[#ddd2c5] lg:block">
              <iframe
                title={t('pages.contact.visitOffice.heading')}
                src={OFFICE_MAPS_EMBED_URL}
                className="absolute inset-0 h-full w-full grayscale-[20%]"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      <ClosingCta eyebrow={t('nav.searchCars')} heading={t('pages.contact.cta.heading')} />
    </div>
  )
}

function ContactForm() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [state, setState] = useState<FormState>({ status: 'idle' })

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
    <form onSubmit={handleSubmit} noValidate className="border border-[#e5ddd2] bg-white shadow-[0_18px_50px_rgba(72,54,43,0.07)]">
      <div className="border-b border-[#ece5dc] px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center bg-brand-gold text-white">
            <Send className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-hero-serif text-2xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-3xl">
              {t('pages.contact.form.heading')}
            </h2>
            <p className="mt-1 text-sm leading-6 text-text-muted">{t('pages.contact.methods.email.note')}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label={t('pages.contact.form.name')} error={errors.name} errorId="contact-name-error">
            <input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'contact-name-error' : undefined}
            />
          </FormField>

          <FormField label={t('pages.contact.form.email')} error={errors.email} errorId="contact-email-error">
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
              inputMode="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'contact-email-error' : undefined}
            />
          </FormField>
        </div>

        <FormField label={t('pages.contact.form.subject')}>
          <input id="contact-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
        </FormField>

        <FormField label={t('pages.contact.form.message')} error={errors.message} errorId="contact-message-error">
          <textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className={inputClass + ' resize-y'}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? 'contact-message-error' : undefined}
          />
        </FormField>

        <div className="flex flex-col-reverse gap-4 border-t border-[#ece5dc] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-xs leading-5 text-text-muted">{t('pages.contact.form.note')}</p>
          <Button type="submit" loading={state.status === 'sending'} fullWidthOnMobile className="min-w-40">
            {state.status === 'sending' ? (
              t('pages.contact.form.sending')
            ) : (
              <>
                {t('pages.contact.form.submit')}
                <Send className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>

        <div aria-live="polite">
          {state.status === 'sent' && (
            <p className="flex items-start gap-3 border border-success/25 bg-success-bg px-4 py-3 text-sm leading-6 text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t('pages.contact.form.success')}
            </p>
          )}
          {errors.submit && <p className="border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{errors.submit}</p>}
        </div>
      </div>
    </form>
  )
}

function QuickContactCard({
  href,
  external = false,
  icon: Icon,
  label,
  value,
  className = '',
}: {
  href: string
  external?: boolean
  icon: LucideIcon
  label: string
  value: string
  className?: string
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={
        'group flex min-h-24 flex-col justify-between border border-[#e1d8ce] bg-white p-3 shadow-[0_10px_30px_rgba(72,54,43,0.05)] transition-all hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-[0_18px_40px_rgba(72,54,43,0.09)] sm:min-h-32 sm:p-5 ' +
        className
      }
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-8 w-8 place-items-center bg-brand-gold/10 text-brand-gold sm:h-10 sm:w-10">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-brand-gold/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
      <div className="mt-3 min-w-0 sm:mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">{label}</p>
        <p className="mt-1 truncate text-xs font-semibold text-brand-navy sm:text-sm">{value}</p>
      </div>
    </a>
  )
}

function FormField({
  label,
  children,
  error,
  errorId,
}: {
  label: string
  children: ReactElement<{ id?: string }>
  error?: string
  errorId?: string
}) {
  return (
    <div>
      <label htmlFor={children.props.id} className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-brand-navy">
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  )
}

const inputClass =
  'min-h-12 w-full border border-[#d9d1c7] bg-[#fdfbf8] px-4 py-3 text-base text-brand-navy outline-none transition-[border-color,box-shadow,background-color] placeholder:text-text-subtle hover:border-[#bfb3a6] focus:border-brand-gold focus:bg-white focus:shadow-[0_0_0_3px_rgba(92,9,49,0.08)] sm:text-sm'
