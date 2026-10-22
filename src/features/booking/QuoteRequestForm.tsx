import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { readAttribution, trackQuoteSubmitted } from '@/lib/tracking'
import { Eyebrow } from '@/features/shared/ui/Eyebrow'

interface QuoteRequestFormProps {
  /** Prefilled on a vehicle page. */
  vehicleId?: string
  carInterest?: string
  startDate?: string
  endDate?: string
  className?: string
}

type FieldErrors = Partial<Record<'fullName' | 'phone' | 'email' | 'startDate' | 'endDate', string>>

/**
 * "Get a quote" lead form → submit-quote-request Edge Function → `leads`
 * (source_code QUOTE) + urgent admin email. Spam protection: a hidden
 * honeypot input (`website`) plus server-side rate limits in
 * submit_quote_request_public(). UTM attribution is read from the
 * first-party store captureAttribution() fills at boot.
 */
export function QuoteRequestForm({ vehicleId, carInterest, startDate, endDate, className = '' }: QuoteRequestFormProps) {
  const { t } = useTranslation()
  const uid = useId()
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    carInterest: carInterest ?? '',
    startDate: startDate ?? '',
    endDate: endDate ?? '',
    notes: '',
    website: '',
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError('')
    setFieldErrors({})
    const attribution = readAttribution()
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('submit-quote-request', {
        body: {
          ...form,
          vehicleId,
          utmSource: attribution?.utm_source,
          utmMedium: attribution?.utm_medium,
          utmCampaign: attribution?.utm_campaign,
        },
      })
      if (invokeError) {
        // FunctionsHttpError carries the Response; surface the server's guest-safe message.
        const ctx = (invokeError as { context?: Response }).context
        const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null
        if (payload?.fieldErrors) setFieldErrors(payload.fieldErrors as FieldErrors)
        setError(payload?.message ?? t('quoteForm.errorGeneric'))
        setStatus('idle')
        return
      }
      if (data?.leadId) trackQuoteSubmitted({ leadId: data.leadId, vehicle: form.carInterest || null })
      setStatus('sent')
    } catch {
      setError(t('quoteForm.errorGeneric'))
      setStatus('idle')
    }
  }

  const input =
    'mt-1 block w-full rounded-xl border border-brand-navy/15 bg-white px-3.5 py-2.5 text-sm text-brand-navy placeholder:text-brand-navy/40 focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/30'
  const label = 'block text-xs font-semibold text-brand-navy/80'
  const fieldError = (key: keyof FieldErrors) =>
    fieldErrors[key] ? (
      <p id={`${uid}-${key}-err`} className="mt-1 text-xs text-error">
        {fieldErrors[key]}
      </p>
    ) : null

  return (
    <section id="get-a-quote" className={'rounded-2xl border border-brand-navy/10 bg-white p-5 shadow-sm sm:p-8 ' + className}>
      {status === 'sent' ? (
        <div className="flex flex-col items-center py-6 text-center" role="status">
          <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-semibold text-brand-navy">{t('quoteForm.successTitle')}</h2>
          <p className="mt-2 max-w-md text-sm text-text-muted">{t('quoteForm.successBody')}</p>
        </div>
      ) : (
        <>
          <Eyebrow className="mb-3">{t('quoteForm.eyebrow')}</Eyebrow>
          <h2 className="text-2xl font-semibold text-brand-navy sm:text-3xl">{t('quoteForm.title')}</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">{t('quoteForm.subtitle')}</p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
            {/* Honeypot — invisible to people, filled by bots. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor={`${uid}-website`}>Website</label>
              <input id={`${uid}-website`} name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
            </div>

            <div>
              <label htmlFor={`${uid}-name`} className={label}>{t('quoteForm.name')}</label>
              <input id={`${uid}-name`} required autoComplete="name" value={form.fullName} onChange={set('fullName')} className={input}
                aria-invalid={!!fieldErrors.fullName} aria-describedby={fieldErrors.fullName ? `${uid}-fullName-err` : undefined} />
              {fieldError('fullName')}
            </div>
            <div>
              <label htmlFor={`${uid}-phone`} className={label}>{t('quoteForm.phone')}</label>
              <input id={`${uid}-phone`} required type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder={t('quoteForm.phonePlaceholder')}
                value={form.phone} onChange={set('phone')} className={input}
                aria-invalid={!!fieldErrors.phone} aria-describedby={fieldErrors.phone ? `${uid}-phone-err` : undefined} />
              {fieldError('phone')}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`${uid}-car`} className={label}>{t('quoteForm.car')}</label>
              <input id={`${uid}-car`} placeholder={t('quoteForm.carPlaceholder')} value={form.carInterest} onChange={set('carInterest')} className={input} />
            </div>
            <div>
              <label htmlFor={`${uid}-start`} className={label}>{t('quoteForm.startDate')}</label>
              <input id={`${uid}-start`} type="date" value={form.startDate} onChange={set('startDate')} className={input} />
              {fieldError('startDate')}
            </div>
            <div>
              <label htmlFor={`${uid}-end`} className={label}>{t('quoteForm.endDate')}</label>
              <input id={`${uid}-end`} type="date" min={form.startDate || undefined} value={form.endDate} onChange={set('endDate')} className={input} />
              {fieldError('endDate')}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`${uid}-notes`} className={label}>{t('quoteForm.notes')}</label>
              <textarea id={`${uid}-notes`} rows={2} maxLength={1000} value={form.notes} onChange={set('notes')} className={input} />
            </div>

            {error && (
              <p role="alert" className="text-sm text-error sm:col-span-2">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-text-muted">{t('quoteForm.privacy')}</p>
              <button
                type="submit"
                disabled={status === 'sending'}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-gold px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-gold-dark disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {status === 'sending' ? t('quoteForm.sending') : t('quoteForm.submit')}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}
