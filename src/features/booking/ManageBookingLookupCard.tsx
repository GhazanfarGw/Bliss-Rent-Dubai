import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, UserRound, HelpCircle } from 'lucide-react'
import { inputClass } from '@/features/shared/ui/inputClasses'
import { Button } from '@/features/shared/ui/Button'
import { WHATSAPP_URL } from '@/features/booking/contactLinks'

export interface ManageBookingLookupCardProps {
  query: string
  onQueryChange: (value: string) => void
  lastName: string
  onLastNameChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  loading: boolean
  notFound: boolean
  errorMessage: string | null
}

/**
 * The Manage Booking page's lookup form: two fields (reference/plate + last
 * name), a WhatsApp help affordance in place of a "log in to your account"
 * link this project has no login system to support (see lookupApi.ts), and
 * a rule with a single right-aligned submit button — this component stays
 * a bare `<form>` with no card chrome of its own; ManageBookingHero.tsx
 * embeds it inside the white card it overlaps its dark band with, so the
 * card framing lives one level up rather than here.
 *
 * Presentational only — all state, the lookupBooking() call, and the
 * last-name check live in ManageBookingPage.
 */
export function ManageBookingLookupCard({
  query,
  onQueryChange,
  lastName,
  onLastNameChange,
  onSubmit,
  loading,
  notFound,
  errorMessage,
}: ManageBookingLookupCardProps) {
  const { t } = useTranslation()

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
        <label className="relative block flex-1">
          <span className="sr-only">{t('manageBooking.queryLabel')}</span>
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4.5 w-4.5 text-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('manageBooking.queryLabel')}
            className={inputClass() + ' py-3 ps-10'}
            autoComplete="off"
          />
        </label>

        <button
          type="button"
          className="mx-auto flex h-9 w-9 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-brand-gold sm:mx-0"
          aria-label={t('manageBooking.helpAriaLabel')}
          title={t('manageBooking.helpText')}
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
        </button>

        <label className="relative block flex-1">
          <span className="sr-only">{t('manageBooking.lastNameLabel')}</span>
          <UserRound className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4.5 w-4.5 text-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={lastName}
            onChange={(e) => onLastNameChange(e.target.value)}
            placeholder={t('manageBooking.lastNameLabel')}
            className={inputClass() + ' py-3 ps-10'}
            autoComplete="family-name"
          />
        </label>
      </div>

      <p className="mt-4 text-sm leading-6 text-text-muted">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-navy underline decoration-brand-gold decoration-2 underline-offset-4"
        >
          {t('manageBooking.helpLinkCta')}
        </a>{' '}
        {t('manageBooking.helpLinkBody')}
      </p>

      {notFound && (
        <p className="mt-4 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">{t('manageBooking.notFound')}</p>
      )}
      {errorMessage && (
        <p className="mt-4 rounded-lg border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{errorMessage}</p>
      )}

      <hr className="mt-8 border-brand-navy/15 sm:mt-10" />

      <div className="mt-6 flex justify-center sm:justify-end">
        <Button type="submit" loading={loading} fullWidthOnMobile>
          {loading ? t('manageBooking.checking') : t('manageBooking.submit')}
        </Button>
      </div>
    </form>
  )
}
