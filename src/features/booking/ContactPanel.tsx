import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Mail, MessageCircle, ExternalLink } from 'lucide-react'
import { WHATSAPP_URL, SUPPORT_EMAIL, SUPPORT_EMAIL_HREF } from '@/features/booking/contactLinks'

/**
 * Phase 11 correction — the homepage navigator's Contact tab. Exactly two
 * contact methods, per spec: WhatsApp and Email. Both links reuse the
 * real, already-configured contact details found elsewhere in the app
 * (see contactLinks.ts) — nothing invented here. The label/note copy is
 * pulled from the existing Contact Us page translations so the wording
 * stays consistent across the app.
 */
export function ContactPanel() {
  const { t } = useTranslation()

  return (
    <div>
      <h2 className="text-2xl font-black tracking-[-0.04em] text-brand-navy sm:text-3xl">{t('home.navigator.contact.heading')}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">{t('home.navigator.contact.intro')}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="group flex items-start gap-4 rounded-2xl border border-brand-gold/20 bg-[linear-gradient(180deg,#ffffff_0%,#f9f5f1_100%)] p-5 transition-transform hover:-translate-y-0.5"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-brand-navy">{t('home.navigator.contact.whatsappLabel')}</span>
            <span className="mt-1 block text-xs leading-5 text-text-muted">{t('pages.contact.methods.whatsapp.note')}</span>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-success">
              {t('home.navigator.contact.whatsappLabel')}
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            </span>
          </span>
        </a>

        <a
          href={SUPPORT_EMAIL_HREF}
          className="group flex items-start gap-4 rounded-2xl border border-brand-gold/20 bg-[linear-gradient(180deg,#ffffff_0%,#f9f5f1_100%)] p-5 transition-transform hover:-translate-y-0.5"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-lavender text-brand-gold-dark">
            <Mail className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-brand-navy">{t('home.navigator.contact.emailLabel')}</span>
            <span className="mt-1 block truncate font-mono text-xs text-text-muted">{SUPPORT_EMAIL}</span>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-gold-dark">
              {t('home.navigator.contact.emailLabel')}
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            </span>
          </span>
        </a>
      </div>

      <Link
        to="/contact"
        className="mt-5 inline-block text-sm font-semibold text-brand-navy underline decoration-brand-gold decoration-2 underline-offset-4"
      >
        {t('home.navigator.contact.morePageLink')}
      </Link>
    </div>
  )
}
