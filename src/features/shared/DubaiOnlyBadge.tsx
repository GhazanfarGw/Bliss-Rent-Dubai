import { useTranslation } from 'react-i18next'

export function DubaiOnlyBadge({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full border border-brand-gold/50 bg-brand-gold/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-gold-dark ' +
        className
      }
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 2a6 6 0 00-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 00-6-6zm0 8.25a2.25 2.25 0 110-4.5 2.25 2.25 0 010 4.5z" />
      </svg>
      {t('common.dubaiOnly')}
    </span>
  )
}
