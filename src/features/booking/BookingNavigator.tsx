import { useEffect, useRef, useState, type ComponentType } from 'react'
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
 * Mobile (below md): a single "Booking Menu" dropdown trigger — never four
 * stacked tabs — that opens a listbox of the same four options; picking
 * one closes the menu and swaps the panel below, exactly as specified.
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  function selectTab(tab: TabKey) {
    setActiveTab(tab)
    setMenuOpen(false)
  }

  const ActiveIcon = TAB_ICONS[activeTab]

  return (
    <div>
      {/* Desktop: full horizontal tab bar (md and up). White header per the
          Phase 11 header/hero redesign (was Deep Space Blue) — active state
          still reads via the Champagne Gold underline + Berry icon/label,
          so the accent language is unchanged, only the bar's own bg is. */}
      <nav aria-label={t('home.navigator.ariaLabel')} className="hidden rounded-t-[2rem] border border-b-0 border-border bg-white md:flex">
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
                'flex flex-1 items-center justify-center gap-2.5 border-b-[3px] px-4 py-5 text-start transition-colors ' +
                (active ? 'border-brand-champagne bg-brand-lavender/50' : 'border-transparent hover:bg-surface-muted')
              }
            >
              <Icon className={'h-5 w-5 shrink-0 ' + (active ? 'text-brand-gold-dark' : 'text-text-muted')} aria-hidden={true} />
              <span className="min-w-0">
                <span className={'block text-sm font-bold tracking-tight ' + (active ? 'text-brand-navy' : 'text-text-muted')}>
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

      {/* Mobile: a single dropdown trigger, never four stacked tabs (below md). */}
      <div ref={menuRef} className="relative rounded-t-[2rem] border border-b-0 border-border bg-white p-3 md:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          aria-label={`${t('home.navigator.mobileMenuLabel')}: ${t(`home.navigator.tabs.${activeTab}.label`)}`}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface-muted px-4 py-3.5 text-brand-navy"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <ActiveIcon className="h-4.5 w-4.5 shrink-0 text-brand-champagne" aria-hidden={true} />
            <span className="truncate text-sm font-bold">{t(`home.navigator.tabs.${activeTab}.label`)}</span>
          </span>
          <ChevronDown className={'h-4 w-4 shrink-0 transition-transform ' + (menuOpen ? 'rotate-180' : '')} aria-hidden="true" />
        </button>

        {menuOpen && (
          <ul
            role="listbox"
            aria-label={t('home.navigator.mobileMenuLabel')}
            className="absolute inset-x-3 top-[calc(100%-2px)] z-20 overflow-hidden rounded-2xl border border-border bg-white shadow-[0_20px_45px_rgba(11,19,43,0.3)]"
          >
            {TAB_ORDER.map((tab) => {
              const Icon = TAB_ICONS[tab]
              const active = tab === activeTab
              return (
                <li key={tab}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => selectTab(tab)}
                    className={
                      'flex min-h-14 w-full items-center gap-3 px-4 py-3 text-start transition-colors ' +
                      (active ? 'bg-brand-lavender/60' : 'hover:bg-surface-muted')
                    }
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0 text-brand-gold-dark" aria-hidden={true} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-brand-navy">{t(`home.navigator.tabs.${tab}.label`)}</span>
                      <span className="block truncate text-xs text-text-muted">{t(`home.navigator.tabs.${tab}.description`)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Active panel content. */}
      <div className="rounded-b-[2rem] bg-white p-5 sm:p-7 lg:p-8">
        {activeTab === 'search' && (
          <>
            <div className="max-w-3xl">
              <h2 className="text-3xl font-black tracking-[-0.06em] text-[#1a232d] sm:text-5xl">{t('home.booking.title')}</h2>
              <p className="mt-3 text-lg leading-8 text-[#5f6977]">{t('home.booking.subtitle')}</p>
            </div>
            <div className="mt-6">
              <SearchWidget compact layout="row" onSearch={onSearch} />
            </div>
          </>
        )}
        {activeTab === 'manage' && <ManageBookingVerifyPanel />}
        {activeTab === 'status' && <BookingStatusPanel />}
        {activeTab === 'contact' && <ContactPanel />}
      </div>
    </div>
  )
}
