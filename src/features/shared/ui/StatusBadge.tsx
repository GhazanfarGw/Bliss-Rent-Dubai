import { useTranslation } from 'react-i18next'
import { STATUS_TONE_CLASSES, STATUS_VALUE_TONE } from './statusTones'

export interface StatusBadgeProps {
  status: string
  /** Translation namespace prefix. Defaults to the existing admin
   *  namespace (`admin.status.*`) so `AdminStatusBadge` can alias
   *  straight through with zero behavior change. A future
   *  customer-facing status vocabulary can pass its own prefix. */
  translationPrefix?: string
}

/**
 * One status-chip look shared by admin and customer surfaces alike —
 * generalizes the pre-Phase-8 `AdminStatusBadge` (whose tone map is
 * unchanged, see `statusTones.ts`) so the same component can eventually
 * serve vehicle/reserved, extension/late, etc. on the customer side
 * instead of each file inventing its own badge markup and colors.
 */
export function StatusBadge({ status, translationPrefix = 'admin.status' }: StatusBadgeProps) {
  const { t } = useTranslation()
  const tone = STATUS_VALUE_TONE[status] ?? 'neutral'
  return (
    <span className={'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ' + STATUS_TONE_CLASSES[tone]}>
      {t(`${translationPrefix}.${status}`, { defaultValue: status })}
    </span>
  )
}
