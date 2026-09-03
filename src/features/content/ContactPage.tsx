import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabaseClient'
import { SectionHeader } from '@/features/shared/ui/SectionHeader'

type FormState = { status: 'idle' | 'sending' | 'sent' }

/**
 * Contact Us — contact methods (placeholders until real numbers/inboxes
 * exist) plus a message form.
 *
 * Phase 9H: `handleSubmit` now calls the real submit-complaint Edge
 * Function (previously a client-side-only `setTimeout` stub with no
 * backend at all). Validation is unchanged — the server re-checks the
 * same three fields, so nothing here can regress; a submission failure
 * (network, or a server-side validation mismatch) surfaces as a plain
 * inline error rather than a false "sent" state.
 */
export function ContactPage() {
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

  type Method = { label: string; value: string; note: string }
  const methods: Method[] = [
    t('pages.contact.methods.whatsapp', { returnObjects: true }) as unknown as Method,
    t('pages.contact.methods.email', { returnObjects: true }) as unknown as Method,
    t('pages.contact.methods.address', { returnObjects: true }) as unknown as Method,
    t('pages.contact.methods.hours', { returnObjects: true }) as unknown as Method,
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <SectionHeader title={t('pages.contact.title')} description={t('pages.contact.subtitle')} />

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <div className="space-y-5">
          {methods.map((m) => (
            <div key={m.label} className="rounded-xl border border-brand-navy/10 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{m.label}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-brand-navy">{m.value}</p>
              {m.note && <p className="mt-1 text-xs text-text-muted">{m.note}</p>}
            </div>
          ))}
          <p className="rounded-xl border border-brand-lavender bg-brand-lavender/30 px-4 py-3 text-xs text-text-muted">
            {t('pages.contact.supportNote')}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-brand-navy/10 bg-white p-6">
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

            <button
              type="submit"
              disabled={state.status === 'sending'}
              className="w-full rounded-lg bg-brand-gold px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold-light disabled:opacity-60"
            >
              {state.status === 'sending' ? t('pages.contact.form.sending') : t('pages.contact.form.submit')}
            </button>

            {state.status === 'sent' && (
              <p className="rounded-lg border border-success/25 bg-success-bg px-4 py-3 text-sm text-success">
                {t('pages.contact.form.success')}
              </p>
            )}
            {errors.submit && (
              <p className="rounded-lg border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{errors.submit}</p>
            )}
            <p className="text-xs text-text-muted">{t('pages.contact.form.note')}</p>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-brand-navy outline-none transition-colors focus:border-brand-navy focus:ring-1 focus:ring-brand-navy'
