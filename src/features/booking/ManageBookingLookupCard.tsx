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
 * The Manage Booking page's lookup form. Rebuilt per a direct redesign
 * request modeled on an airline "manage booking" reference page: two
 * fields and a help affordance flow directly on the page — no card
 * border, no shadow, no rounded box — a rule, then a single right-aligned
 * button below it, exactly like that reference. `Button`'s own default
 * styling already gives the sharp corners and borderless brand-maroon
 * fill the redesign asked for (see buttonClasses.ts — `rounded-none`,
 * `bg-brand-gold` with no border, unchanged).
 *
 * Differs from the reference in the one place blindly copying it would
 * ship something false: this project has no customer login/account
 * system at all (see lookupApi.ts) — there is nothing to send a "log in
 * to your account" link to. The reference's secondary link is replaced
 * with a real, working one (WhatsApp — contactLinks.ts's WHATSAPP_URL)
 * in the same visual slot.
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
    <form onSubmit={onSubmit} noValidate className="mt-10 sm:mt-12">
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
