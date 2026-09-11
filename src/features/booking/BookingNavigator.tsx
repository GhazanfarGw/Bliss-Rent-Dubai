import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Car, CalendarSearch, ClipboardCheck, Mail, ChevronDown } from 'lucide-react'
import { SearchWidget } from '@/features/booking/SearchWidget'
import { ManageBookingVerifyPanel } from '@/features/booking/ManageBookingVerifyPanel'
import { BookingStatusPanel } from '@/features/booking/BookingStatusPanel'
import { ContactPanel } from '@/features/booking/ContactPanel'
import type { SearchCriteria } from '@/types/domain'

type TabKey = 'search' | 'manage' | 'status' | 'contact'

const TAB_ORDER: TabKey[] = ['search', 'manage', 'status', 'contact']

const TAB_ICONS: Record<TabKey, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  search: Car,
  manage: CalendarSearch,
  status: ClipboardCheck,
  contact: Mail,
}

interface BookingNavigatorProps {
  onSearch: (criteria: SearchCriteria) => void
}

/**
 * Phase 11 correction — replaces the earlier small pill-tab row
 * (BookingNavigatorTabs, kept Manage Booking/Contact as plain page links)
 * with a substantial, four-option premium booking navigator: Search Cars /
 * Manage Booking / Booking Status / Contact. Structurally inspired by
 * airline booking widgets (a dark tab bar over a content panel) per the
 * owner's Qatar Airways reference — an ORIGINAL Bliss Rent treatment
 * (Deep Space Blue bar, Muted Champagne Gold active accent), not a visual
 * copy of any airline's branding or UI.
 *
 * Desktop (md and up): a full horizontal tab bar, each tab showing an
 * icon, label, and short description, with a clear active indicator.
 * Mobile (below md): four stacked accordion rows, with one existing panel
 * expanded inline at a time.
 *
 * Only "Search Cars" reuses existing search logic (SearchWidget,
 * unchanged). "Manage Booking" and "Booking Status" are new, minimal
 * panels that call the SAME existing `lookupBooking()` RPC — see
 * ManageBookingVerifyPanel.tsx and BookingStatusPanel.tsx for exactly how
 * each reuses it without introducing a second verification algorithm.
 * "Contact" reuses the app's real, already-configured WhatsApp/email
 * details (contactLinks.ts) — see ContactPanel.tsx.
 */
export function BookingNavigator({ onSearch }: BookingNavigatorProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabKey>('search')
  const [mobileOpenTab, setMobileOpenTab] = useState<TabKey | null>(null)

  function selectTab(tab: TabKey) {
    setActiveTab(tab)
  }

  function toggleMobileTab(tab: TabKey) {
    setMobileOpenTab((openTab) => (openTab === tab ? null : tab))
  }

  function renderPanel(tab: TabKey) {
    if (tab === 'search') {
      return (
        <SearchWidget compact layout="row" onSearch={onSearch} />
      )
    }
    if (tab === 'manage') return <ManageBookingVerifyPanel />
    if (tab === 'status') return <BookingStatusPanel />
    return <ContactPanel />
  }

  return (
    <div>
      {/* Desktop: full horizontal tab bar (md and up). White header per the
          Phase 11 header/hero redesign (was Deep Space Blue) — active state
          still reads via the Champagne Gold underline + Berry icon/label,
          so the accent language is unchanged, only the bar's own bg is. */}
      <nav aria-label={t('home.navigator.ariaLabel')} className="hidden border border-b-0 border-border bg-white md:flex">
        {TAB_ORDER.map((tab) => {
          const Icon = TAB_ICONS[tab]
          const active = tab === activeTab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => selectTab(tab)}
              aria-current={active ? 'page' : undefined}
              aria-label={`${t(`home.navigator.tabs.${tab}.label`)} — ${t(`home.navigator.tabs.${tab}.description`)}`}
              className={
                'flex flex-1 items-center justify-center gap-2.5 border-b-[3px] px-4 py-4 text-start transition-colors bg-surface-muted ' +
                (active ? 'border-brand-gold bg-brand-lavender/50' : 'border-transparent hover:bg-white')
              }
            >
              <Icon className={'h-5 w-5 shrink-0 ' + (active ? 'text-[#5C0931]' : 'text-text-muted')} aria-hidden={true} />
              <span className="min-w-0">
                <span className={'block text-base font-bold tracking-tight ' + (active ? 'text-brand-navy' : 'text-text-muted')}>
                  {t(`home.navigator.tabs.${tab}.label`)}
                </span>
                <span className="hidden truncate text-[11px] font-medium text-text-muted lg:block">
                  {t(`home.navigator.tabs.${tab}.description`)}
                </span>
              </span>
            </button>
          )
        })}
      </nav>

      {/* Mobile: one accordion row per booking section (below md). */}
      <div className="border border-b-0 border-border bg-white md:hidden">
        {TAB_ORDER.map((tab) => {
          const Icon = TAB_ICONS[tab]
          const open = tab === mobileOpenTab
          const panelId = `booking-panel-${tab}`
          return (
            <div key={tab} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => toggleMobileTab(tab)}
                aria-expanded={open}
                aria-controls={panelId}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-4 text-start text-brand-navy transition-colors hover:bg-surface-muted rtl:text-right"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0 text-brand-gold-dark" aria-hidden={true} />
                  <span className="text-sm font-semibold">{t(`home.navigator.tabs.${tab}.label`)}</span>
                </span>
                <ChevronDown className={'h-4 w-4 shrink-0 text-brand-gold-dark transition-transform ' + (open ? 'rotate-180' : '')} aria-hidden="true" />
              </button>
              {open && <div id={panelId} className="border-t border-border bg-white p-5 sm:p-7">{renderPanel(tab)}</div>}
            </div>
          )
        })}
      </div>

      {/* Active panel content. */}
      <div className="hidden rounded-b-[2rem] bg-white p-5 sm:p-7 lg:p-8 md:block">{renderPanel(activeTab)}</div>
    </div>
  )
}
