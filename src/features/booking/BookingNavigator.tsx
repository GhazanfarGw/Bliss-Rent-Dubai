import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarSearch, Car } from 'lucide-react'
import { SearchWidget } from '@/features/booking/SearchWidget'
import { ManageBookingVerifyPanel } from '@/features/booking/ManageBookingVerifyPanel'
import type { SearchCriteria } from '@/types/domain'

type TabKey = 'search' | 'manage'

const TAB_ORDER: TabKey[] = ['search', 'manage']

const TAB_ICONS: Record<TabKey, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  search: Car,
  manage: CalendarSearch,
}

interface BookingNavigatorProps {
  onSearch: (criteria: SearchCriteria) => void
}

/**
 * The homepage's single booking desk. Two customer goals are enough here:
 * start a booking, or reopen an existing one — direct WhatsApp/email help is
 * one click away on every page via the header, so it no longer needs its
 * own tab here too.
 *
 * One shared tab panel is used at every breakpoint. That keeps the selected
 * task and any entered form data stable when the viewport changes, while the
 * controls remain easy to scan and tap on mobile.
 */
export function BookingNavigator({ onSearch }: BookingNavigatorProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabKey>('search')

  function renderPanel() {
    if (activeTab === 'search') {
      return <SearchWidget layout="row" compact onSearch={onSearch} />
    }

    return <ManageBookingVerifyPanel />
  }

  return (
    <div className="overflow-hidden border border-[#ded5ca] border-t-4 border-t-brand-gold bg-white">
      <div className="bg-[#f8f3ed] lg:flex lg:items-stretch">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5 lg:w-[21rem] lg:shrink-0 lg:border-e lg:border-[#ded5ca] lg:px-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-brand-gold-dark">{t('home.navigator.eyebrow')}</p>
            <h2 className="font-hero-serif mt-1 text-xl font-semibold tracking-[-0.04em] text-brand-navy sm:text-2xl">
              {t('home.navigator.title')}
            </h2>
          </div>
          <p className="hidden max-w-44 text-end text-[11px] leading-4 text-text-muted sm:block lg:hidden">{t('home.navigator.intro')}</p>
        </div>

        <nav aria-label={t('home.navigator.ariaLabel')} className="min-w-0 flex-1 border-t border-[#ded5ca] lg:border-t-0">
          <div role="tablist" className="grid h-full grid-cols-2">
            {TAB_ORDER.map((tab) => {
              const Icon = TAB_ICONS[tab]
              const active = tab === activeTab
              const tabId = `booking-tab-${tab}`
              return (
                <button
                  key={tab}
                  id={tabId}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-current={active ? 'page' : undefined}
                  aria-controls="booking-panel"
                  tabIndex={active ? 0 : -1}
                  onClick={() => setActiveTab(tab)}
                  className={
                    'relative flex min-h-14 min-w-0 items-center justify-center gap-2 border-e border-[#ded5ca] px-2 py-2.5 text-center transition-colors last:border-e-0 sm:min-h-16 sm:px-4 ' +
                    (active ? 'bg-brand-gold text-white' : 'bg-white text-brand-navy hover:bg-brand-gold/5')
                  }
                >
                  <Icon className={'h-4 w-4 shrink-0 sm:h-5 sm:w-5 ' + (active ? 'text-brand-champagne' : 'text-brand-gold')} aria-hidden={true} />
                  <span className="truncate text-[11px] font-bold leading-4 sm:text-sm">{t(`home.navigator.tabs.${tab}.label`)}</span>
                  {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-champagne" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </nav>
      </div>

      <div
        id="booking-panel"
        role="tabpanel"
        aria-labelledby={`booking-tab-${activeTab}`}
        className="border-t border-[#ded5ca] bg-white p-3 sm:p-4"
      >
        {renderPanel()}
      </div>
    </div>
  )
}
