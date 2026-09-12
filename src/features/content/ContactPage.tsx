import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Mail, MapPin, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { SectionHeader } from '@/features/shared/ui/SectionHeader'
import { Button } from '@/features/shared/ui/Button'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { SUPPORT_EMAIL, SUPPORT_EMAIL_HREF, WHATSAPP_PHONE_DISPLAY, WHATSAPP_URL } from '@/features/booking/contactLinks'

type FormState = { status: 'idle' | 'sending' | 'sent' }

const OFFICE_ADDRESS = 'Apt 121B, Block B, Sajaya 7 Building, Manama Street, Nad Al Sheba 3, Dubai, UAE'
const OFFICE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(OFFICE_ADDRESS)}`

/**
 * Contact Us — restyled to match the premium editorial system already
 * established sitewide (icon-badge cards, sharp corners, gold accents —
 * same pattern as WhyChooseSection / the redesigned About page).
 *
 * Real-data changes alongside the visual redesign:
 *  - WhatsApp and email are now actual clickable links (wa.me / mailto:),
 *    reusing the single-source-of-truth constants from contactLinks.ts
 *    instead of duplicating the number/address as plain display text.
 *  - The office address placeholder ('[Office address, Dubai, UAE]') is
 *    replaced with the real address, plus a "Get directions" link to
 *    Google Maps built from that same address — no separate maps API key
 *    or new backend call, just a plain maps.google.com search URL.
 *  - Support hours stays an intentional bracketed placeholder
 *    ('[e.g. 24/7, or specific hours]') — no real value was given for
 *    it, and this page's own convention (see the address placeholder it
 *    replaced) is to never invent one.
 *
 * Form submission logic (submit-complaint Edge Function, validation) is
 * unchanged from the Phase 9H implementation.
 */
export function ContactPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('pages.contact.title'))
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
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <SectionHeader title={t('pages.contact.title')} description={t('pages.contact.subtitle')} />

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <div className="space-y-5">
          {/* WhatsApp — a real wa.me link, not display-only text. */}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="group flex gap-4 border border-[#ece7df] bg-white p-5 transition-colors hover:border-brand-gold"
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

          {/* Email — a real mailto: link. */}
          <a
            href={SUPPORT_EMAIL_HREF}
            className="group flex gap-4 border border-[#ece7df] bg-white p-5 transition-colors hover:border-brand-gold"
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

          {/* Office address — real address, plus a Get Directions link. */}
          <div className="flex gap-4 border border-[#ece7df] bg-white p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-brand-navy text-white">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('pages.contact.methods.address.label')}</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-brand-navy">{t('pages.contact.methods.address.value')}</p>
              <p className="mt-1 text-xs text-text-muted">{t('pages.contact.methods.address.note')}</p>
              <a
                href={OFFICE_MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-brand-gold-dark underline underline-offset-2 hover:text-brand-gold"
              >
                {t('pages.contact.getDirections')}
              </a>
            </div>
          </div>

          {/* Support hours — unchanged bracketed placeholder; no real value was given. */}
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

        <form onSubmit={handleSubmit} noValidate className="border border-[#ece7df] bg-white p-6">
          <h2 className="text-base font-semibold text-brand-navy">{t('pages.contact.form.heading')}</h2>

          <div className="mt-4 space-y-4">
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
  )
}

const inputClass =
  'w-full rounded-none border border-border bg-white px-3 py-2.5 text-sm text-brand-navy outline-none transition-colors focus:border-brand-navy focus:ring-1 focus:ring-brand-navy'
