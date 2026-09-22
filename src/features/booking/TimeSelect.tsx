import { useTranslation } from 'react-i18next'
import { inputClass } from '@/features/shared/ui/inputClasses'
import { TIME_OPTIONS, formatTimeLabel } from '@/lib/timeOptions'

interface TimeSelectProps {
  label: string
  ariaLabel: string
  value: string
  onChange: (value: string) => void
  /** Compact single-line variant for the flat search-bar row. */
  row?: boolean
  /** Fill the available column in sectioned booking layouts. */
  fluid?: boolean
}

/**
 * Pickup/Return time-of-day picker — a plain half-hour `<select>`, not a
 * new date/availability concept. It exists purely so the customer can
 * tell us roughly what time they plan to arrive/return, matching the
 * flat search-bar layout customers expect from other UAE rental sites.
 * It does not feed `dateRange.ts`, pricing, or availability — see
 * `src/lib/timeOptions.ts`.
 */
export function TimeSelect({ label, ariaLabel, value, onChange, row = false, fluid = false }: TimeSelectProps) {
  const { i18n } = useTranslation()
  return (
    <div className={row ? 'flex w-full flex-col gap-1 sm:w-28 sm:shrink-0' : fluid ? 'flex w-full flex-col gap-1' : 'flex w-full flex-col gap-1 sm:w-32'}>
      <span className="block text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel} className={inputClass() + ' ltr-nums'}>
        {TIME_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {formatTimeLabel(t, i18n.language)}
          </option>
        ))}
      </select>
    </div>
  )
}
