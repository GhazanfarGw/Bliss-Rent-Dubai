import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronDown, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { readAttribution, trackQuoteSubmitted } from '@/lib/tracking'
import { DIAL_CODES, toInternational } from '@/lib/dialCodes'

interface QuoteRequestFormProps {
  vehicleId?: string
  carInterest?: string
  startDate?: string
  endDate?: string
  className?: string
}

type FieldErrors = Partial<Record<'fullName' | 'phone', string>>

/**
 * Compact "price on WhatsApp" box inside the vehicle page's booking card —
 * for visitors who are not ready to book yet. Collapsed to one line until
 * opened; asks only name + international phone (car and dates come from
 * the page). Submits to the submit-quote-request Edge Function → `leads`
 * (source_code QUOTE) + urgent admin email; shown in /admin/leads.
 * Spam protection: hidden honeypot + server-side rate limits.
 */
export function QuoteRequestForm({ vehicleId, carInterest, startDate, endDate, className = '' }: QuoteRequestFormProps) {
  const { t } = useTranslation()
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [dialIso, setDialIso] = useState('AE')
  const dialCode = DIAL_CODES.find((c) => c.iso === dialIso)?.code ?? '971'
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError('')
    setFieldErrors({})
    const attribution = readAttribution()
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('submit-quote-request', {
        body: {
          fullName,
          phone: phone.trim().startsWith('+') ? phone : toInternational(dialCode, phone),
          carInterest,
          vehicleId,
          startDate,
          endDate,
          website,
          utmSource: attribution?.utm_source,
          utmMedium: attribution?.utm_medium,
          utmCampaign: attribution?.utm_campaign,
        },
      })
      if (invokeError) {
        const ctx = (invokeError as { context?: Response }).context
        const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null
        if (payload?.fieldErrors) setFieldErrors(payload.fieldErrors as FieldErrors)
        setError(payload?.fieldErrors ? '' : (payload?.message ?? t('quoteForm.errorGeneric')))
        setStatus('idle')
        return
      }
      if (data?.leadId) trackQuoteSubmitted({ leadId: data.leadId, vehicle: carInterest ?? null })
      setStatus('sent')
    } catch {
      setError(t('quoteForm.errorGeneric'))
      setStatus('idle')
    }
  }

  const input =
    'block w-full rounded-lg border border-brand-navy/15 bg-white px-3 py-2 text-sm text-brand-navy placeholder:text-brand-navy/40 focus:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand-gold/30'

  if (status === 'sent') {
    return (
      <div className={'flex items-start gap-2 rounded-xl bg-success-bg p-3 text-xs text-brand-navy ' + className} role="status">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        <p>
          <span className="font-semibold">{t('quoteForm.successTitle')}</span> {t('quoteForm.successBody')}
        </p>
      </div>
    )
  }

  return (
    <div className={'rounded-xl border border-brand-navy/10 ' + className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start text-xs font-semibold text-brand-navy"
      >
        <span className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          {t('quoteForm.toggle')}
        </span>
        <ChevronDown className={'h-4 w-4 shrink-0 transition-transform ' + (open ? 'rotate-180' : '')} aria-hidden="true" />
      </button>

      {open && (
        <form id={`${uid}-panel`} onSubmit={handleSubmit} noValidate className="relative space-y-2.5 px-3 pb-3">
          <p className="text-xs text-text-muted">{t('quoteForm.subtitle')}</p>
          {/* Honeypot — invisible to people, filled by bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${uid}-name`} className="sr-only">{t('quoteForm.name')}</label>
            <input id={`${uid}-name`} autoComplete="name" placeholder={t('quoteForm.name')} value={fullName} onChange={(e) => setFullName(e.target.value)}
              className={input} aria-invalid={!!fieldErrors.fullName} />
            {fieldErrors.fullName && <p className="mt-1 text-xs text-error">{fieldErrors.fullName}</p>}
          </div>
          <div>
            <label htmlFor={`${uid}-phone`} className="sr-only">{t('quoteForm.phone')}</label>
            <div className="flex gap-2" dir="ltr">
              <select aria-label={t('quoteForm.countryCode')} value={dialIso} onChange={(e) => setDialIso(e.target.value)} className={input.replace('block w-full', 'w-24 shrink-0').replace('px-3', 'px-2')}>
                {DIAL_CODES.map((c) => (
                  <option key={c.iso} value={c.iso}>
                    {c.flag} +{c.code}
                  </option>
                ))}
              </select>
              <input id={`${uid}-phone`} type="tel" inputMode="tel" autoComplete="tel-national" placeholder={t('quoteForm.phonePlaceholder')}
                value={phone} onChange={(e) => setPhone(e.target.value)} className={input.replace('block w-full', 'block min-w-0 flex-1')} aria-invalid={!!fieldErrors.phone} />
            </div>
            {fieldErrors.phone && <p className="mt-1 text-xs text-error">{fieldErrors.phone}</p>}
          </div>
          {error && <p role="alert" className="text-xs text-error">{error}</p>}
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-full bg-success px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2"
          >
            {status === 'sending' ? t('quoteForm.sending') : t('quoteForm.submit')}
          </button>
        </form>
      )}
    </div>
  )
}
