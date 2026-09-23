import { useTranslation } from 'react-i18next'
import { Mail, MessageCircle, Phone } from 'lucide-react'
import { Eyebrow } from '@/features/shared/ui/Eyebrow'
import { PHONE_URL, SUPPORT_EMAIL, SUPPORT_EMAIL_HREF, WHATSAPP_URL } from '@/features/booking/contactLinks'

/**
 * Closing band for BookCarPage — deliberately not the shared ClosingCta
 * (its primary button always links to /book, which would point right back
 * at the page it's on). A visitor who scrolled this far already has the
 * search form; what they need here is a direct line to a person, using the
 * same real WhatsApp/call/email channels and copy as /contact.
 */
export function BookingSupportSection() {
  const { t } = useTranslation()

  return (
    <section className="bg-surface-warm">
      <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-16 lg:px-8">
        <Eyebrow className="mx-auto justify-center">{t('bookCar.support.eyebrow')}</Eyebrow>
        <h2 className="font-hero-serif mx-auto mt-3 max-w-xl text-2xl font-semibold tracking-[-0.05em] text-brand-navy sm:text-3xl md:text-4xl">
          {t('bookCar.support.title')}
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-text-muted sm:text-base">{t('bookCar.support.subtitle')}</p>

        <div className="mx-auto mt-8 grid max-w-2xl gap-px overflow-hidden border border-[#e7e2da] bg-[#e7e2da] sm:grid-cols-3">
          <SupportLink href={WHATSAPP_URL} icon={MessageCircle} label={t('pages.contact.methods.whatsapp.label')} value={t('pages.contact.methods.whatsapp.value')} external />
          <SupportLink href={PHONE_URL} icon={Phone} label={t('pages.contact.methods.phone.label')} value={t('pages.contact.methods.phone.value')} />
          <SupportLink href={SUPPORT_EMAIL_HREF} icon={Mail} label={t('pages.contact.methods.email.label')} value={SUPPORT_EMAIL} />
        </div>
      </div>
    </section>
  )
}

function SupportLink({
  href,
  icon: Icon,
  label,
  value,
  external = false,
}: {
  href: string
  icon: typeof Mail
  label: string
  value: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="group flex min-h-28 flex-col items-center justify-center gap-2 bg-white px-4 py-6 transition-colors hover:bg-brand-lavender/40"
    >
      <Icon className="h-5 w-5 shrink-0 text-brand-gold" aria-hidden="true" />
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-navy/60">{label}</span>
      <span className="text-sm font-semibold text-brand-navy group-hover:text-brand-gold-dark">{value}</span>
    </a>
  )
}
