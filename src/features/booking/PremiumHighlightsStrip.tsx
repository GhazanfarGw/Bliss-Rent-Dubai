import { useTranslation } from 'react-i18next'
import { CalendarRange, Car, Plane, Zap } from 'lucide-react'

interface HighlightItem {
  title: string
  body: string
}

const ITEM_ICONS = [Plane, CalendarRange, Car, Zap]

/**
 * Compact 4-up reassurance row directly under BookCarPage's search form —
 * the exact moment a visitor is deciding whether to hit submit. Reuses the
 * `home.premiumHighlights` copy (written for this purpose, never wired to
 * any page before now) rather than inventing new marketing copy.
 */
export function PremiumHighlightsStrip() {
  const { t } = useTranslation()
  const items = t('home.premiumHighlights.items', { returnObjects: true }) as HighlightItem[]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {items.map((item, index) => {
        const Icon = ITEM_ICONS[index] ?? Car
        return (
          <div key={item.title} className="white-box flex flex-col gap-2 p-4 sm:p-5">
            <Icon className="h-5 w-5 shrink-0 text-brand-gold" aria-hidden="true" />
            <p className="text-sm font-semibold tracking-[-0.01em] text-brand-navy">{item.title}</p>
            <p className="text-xs leading-5 text-text-muted">{item.body}</p>
          </div>
        )
      })}
    </div>
  )
}
