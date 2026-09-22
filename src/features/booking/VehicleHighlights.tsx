import { useTranslation } from 'react-i18next'
import { specIcon } from '@/features/booking/specIcons'
import { engineLabel, highlightItems, type SpecSource } from '@/lib/vehicleSpecs'

/**
 * The car's headline facts as small icon tiles, for the booking box beside the
 * photos — so the numbers people compare (power, torque, 0–100, top speed, engine)
 * are visible the moment the page opens, on a phone as well as a desktop. Only
 * facts that are filled in appear; a car with none gets no box at all.
 *
 * Tighter padding/icon/text sizes below `sm` — on a phone this sits directly
 * under the photos, above the price and the form, and five two-column tiles
 * at full desktop size ate a lot of that scroll before anything else showed.
 */
export function VehicleHighlights({ vehicle, className = 'mt-4' }: { vehicle: SpecSource; className?: string }) {
  const { t } = useTranslation()
  const items = highlightItems(t, vehicle)
  const engine = engineLabel(vehicle)
  if (items.length === 0 && !engine) return null

  const EngineIcon = specIcon('engine')

  return (
    <dl
      aria-label={t('vehicleSpecs.keyFigures')}
      className={`${className} grid grid-cols-2 gap-1.5 sm:gap-2 [&>*:last-child:nth-child(odd)]:col-span-2`}
    >
      {items.map((item) => {
        const Icon = specIcon(item.key)
        return (
          <div key={item.key} className="flex min-w-0 items-center gap-2 border border-brand-navy/10 bg-surface-warm px-2 py-1.5 sm:gap-2.5 sm:px-2.5 sm:py-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center bg-brand-gold/10 text-brand-gold sm:h-8 sm:w-8">
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <dt className="truncate text-[9px] font-medium uppercase tracking-[0.08em] text-text-muted sm:text-[10px] sm:tracking-[0.1em]">{item.label}</dt>
              <dd className="truncate text-xs font-semibold leading-tight text-brand-navy sm:text-sm">{item.value}</dd>
            </div>
          </div>
        )
      })}
      {engine && (
        <div className="col-span-2 flex min-w-0 items-center gap-2 border border-brand-navy/10 bg-surface-warm px-2 py-1.5 sm:gap-2.5 sm:px-2.5 sm:py-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center bg-brand-gold/10 text-brand-gold sm:h-8 sm:w-8">
            <EngineIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <dt className="text-[9px] font-medium uppercase tracking-[0.08em] text-text-muted sm:text-[10px] sm:tracking-[0.1em]">{t('vehicleSpecs.labels.engine')}</dt>
            <dd className="truncate text-xs font-semibold leading-snug text-brand-navy sm:text-sm">{engine}</dd>
          </div>
        </div>
      )}
    </dl>
  )
}
