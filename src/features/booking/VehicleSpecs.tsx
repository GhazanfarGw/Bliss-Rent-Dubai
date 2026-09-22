import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { specIcon } from '@/features/booking/specIcons'
import { aboutText, specRows, type SpecSource } from '@/lib/vehicleSpecs'

const CARD = 'border border-brand-navy/10 bg-white p-5 shadow-sm sm:p-6'
const HEADING = 'text-lg font-semibold text-brand-navy'

type Tab = 'about' | 'specs'

/**
 * Everything about the car itself, under the photos on its detail page: a short
 * "about this car" story and the full specification table (the headline numbers
 * live in the booking box next to the photos).
 *
 * On a phone the two are tabs, so only one is on screen at a time and the page
 * stays short; from `md` up they are stacked, both visible. The switch is pure
 * CSS (`hidden md:block`), so there is no layout jump or script involved.
 * Each block appears only when there is something real to show — a car with no
 * history entered gets just the specification table, with no tabs at all.
 */
export function VehicleSpecs({ vehicle }: { vehicle: SpecSource }) {
  const { t, i18n } = useTranslation()
  const about = aboutText(vehicle, i18n.language)
  const rows = specRows(t, vehicle)
  const name = `${vehicle.make} ${vehicle.model}`
  // Blank lines in the admin text become separate paragraphs.
  const paragraphs = about ? about.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : []
  const hasAbout = paragraphs.length > 0

  const [tab, setTab] = useState<Tab>(hasAbout ? 'about' : 'specs')
  const active: Tab = hasAbout ? tab : 'specs'

  const tabButton = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      id={`vehicle-tab-${id}`}
      aria-selected={active === id}
      aria-controls={`vehicle-panel-${id}`}
      onClick={() => setTab(id)}
      className={
        'flex-1 border-b-2 px-3 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold ' +
        (active === id ? 'border-brand-gold text-brand-gold' : 'border-transparent text-text-muted hover:text-brand-navy')
      }
    >
      {label}
    </button>
  )

  return (
    <div>
      {hasAbout && (
        <div role="tablist" aria-label={t('vehicleSpecs.tabsLabel')} className="mb-3 flex border-b border-brand-navy/10 md:hidden">
          {tabButton('about', t('vehicleSpecs.tabs.about'))}
          {tabButton('specs', t('vehicleSpecs.tabs.specs'))}
        </div>
      )}

      <div className="space-y-6">
        {hasAbout && (
          <section
            id="vehicle-panel-about"
            role="tabpanel"
            aria-labelledby="vehicle-tab-about"
            className={CARD + (active === 'about' ? '' : ' hidden md:block')}
          >
            <h2 className={HEADING}>{t('vehicleSpecs.aboutTitle', { name })}</h2>
            <div className="mt-3 space-y-3 text-sm leading-7 text-brand-navy/80">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        )}

        <section
          id="vehicle-panel-specs"
          role="tabpanel"
          aria-labelledby={hasAbout ? 'vehicle-tab-specs' : undefined}
          aria-label={hasAbout ? undefined : t('vehicleSpecs.fullSpecs')}
          className={CARD + (active === 'specs' ? '' : ' hidden md:block')}
        >
          <h2 className={HEADING}>{t('vehicleSpecs.fullSpecs')}</h2>
          {/* Phones: two compact tiles per row (label over value) to halve the height.
              From md: the familiar two-column table, label left and value right. */}
          <dl className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-2 md:gap-x-10 md:gap-y-0 md:border-t md:border-brand-navy/10">
            {rows.map((row) => {
              const Icon = specIcon(row.key)
              return (
                <div
                  key={row.key}
                  className={
                    'flex min-w-0 flex-col gap-1 border border-brand-navy/10 bg-surface-warm px-3 py-2.5 md:flex-row md:items-center md:justify-between md:gap-4 md:border-0 md:border-b md:bg-transparent md:px-0 md:py-3 ' +
                    // A long value (the engine) gets the whole row on phones.
                    (row.key === 'engine' || row.key === 'fuelEconomy' ? 'col-span-2 md:col-span-1' : '')
                  }
                >
                  <dt className="flex items-center gap-2 text-xs text-text-muted md:text-sm">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-brand-gold md:h-4 md:w-4" aria-hidden="true" />
                    {row.label}
                  </dt>
                  <dd className="min-w-0 text-sm font-medium text-brand-navy md:text-end">{row.value}</dd>
                </div>
              )
            })}
          </dl>
        </section>
      </div>
    </div>
  )
}
