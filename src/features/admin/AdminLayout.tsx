import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu } from 'lucide-react'
import { useAdminAuth } from '@/features/admin/AdminAuthContext'
import { LanguageSwitcher } from '@/features/shared/LanguageSwitcher'
import { fetchPendingBookingsCount } from '@/features/admin/bookings/adminBookingsApi'
import logoMark from '@/assets/brand/logo-mark.png'

/** How often the sidebar re-checks the pending-bookings count for its workload badge. */
const PENDING_COUNT_POLL_MS = 60_000

const NAV_ITEMS = [
  { to: '/admin', key: 'dashboard', end: true },
  { to: '/admin/bookings', key: 'bookings', end: false },
  { to: '/admin/fleet', key: 'fleet', end: false },
  { to: '/admin/availability', key: 'availability', end: false },
  { to: '/admin/customers', key: 'customers', end: false },
  { to: '/admin/payments', key: 'payments', end: false },
  { to: '/admin/extensions', key: 'extensions', end: false },
  { to: '/admin/complaints', key: 'complaints', end: false },
  { to: '/admin/feedback', key: 'feedback', end: false },
  { to: '/admin/pricing', key: 'pricing', end: false },
  { to: '/admin/emails', key: 'emails', end: false },
  { to: '/admin/audit-log', key: 'auditLog', end: false, superAdminOnly: true },
  { to: '/admin/staff', key: 'staff', end: false, superAdminOnly: true },
  { to: '/admin/settings', key: 'settings', end: false },
] as const

export function AdminLayout() {
  const { t } = useTranslation()
  const { adminProfile, signOut } = useAdminAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const isSuperAdmin = adminProfile?.role === 'super_admin'
  const visibleNavItems = NAV_ITEMS.filter((item) => !('superAdminOnly' in item && item.superAdminOnly) || isSuperAdmin)

  useEffect(() => {
    let cancelled = false
    function load() {
      fetchPendingBookingsCount()
        .then((count) => {
          if (!cancelled) setPendingCount(count)
        })
        .catch(() => {
          // Non-critical — the badge just stays hidden if this fails.
        })
    }
    load()
    const interval = setInterval(load, PENDING_COUNT_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-brand-lavender/20 text-brand-navy">
      {/*
        Sidebar — desktop. Fixed in place: the outer row is h-screen +
        overflow-hidden, so this column never scrolls with the page. Its own
        nav list keeps its independent overflow-y-auto (below) in case the
        menu ever grows taller than the viewport on a short screen.
      */}
      <aside className="hidden w-60 shrink-0 flex-col border-e border-brand-navy/10 bg-white lg:flex">
        <SidebarContent
          adminName={adminProfile?.full_name ?? ''}
          isSuperAdmin={isSuperAdmin}
          navItems={visibleNavItems}
          onSignOut={handleSignOut}
          pendingCount={pendingCount}
        />
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-brand-navy-dark/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 start-0 flex w-64 flex-col bg-white shadow-xl">
            <SidebarContent
              adminName={adminProfile?.full_name ?? ''}
              isSuperAdmin={isSuperAdmin}
              navItems={visibleNavItems}
              onSignOut={handleSignOut}
              onNavigate={() => setMobileOpen(false)}
              pendingCount={pendingCount}
            />
          </aside>
        </div>
      )}

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-brand-navy/10 bg-white px-4 sm:px-6 lg:justify-end">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-navy lg:hidden"
            aria-label={t('admin.nav.toggleMenu')}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <span className="text-sm font-semibold text-brand-navy lg:hidden">{t('admin.nav.title')}</span>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="rounded-lg bg-brand-gold px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold-light"
            >
              {t('admin.nav.signOut')}
            </button>
          </div>
        </header>

        {/* The only scrolling region — sidebar and header stay put, this scrolls independently. */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarContent({
  adminName,
  isSuperAdmin,
  navItems,
  onSignOut,
  onNavigate,
  pendingCount,
}: {
  adminName: string
  isSuperAdmin: boolean
  navItems: readonly { to: string; key: string; end: boolean }[]
  onSignOut: () => void
  onNavigate?: () => void
  pendingCount: number | null
}) {
  const { t } = useTranslation()

  return (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-brand-navy/10 px-5">
        <img src={logoMark} alt="Bliss Rent Dubai" className="h-8 w-auto" />
        <div>
          <p className="text-sm font-semibold leading-tight text-brand-navy">{t('nav.brand')}</p>
          <p className="text-[11px] leading-tight text-text-muted">{t('admin.nav.title')}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ' +
              (isActive ? 'bg-brand-navy text-white' : 'text-text-muted hover:bg-brand-lavender hover:text-brand-navy')
            }
          >
            <span>{t(`admin.nav.${item.key}`)}</span>
            {item.key === 'bookings' && <WorkloadBadge count={pendingCount} />}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-brand-navy/10 p-3">
        <div className="flex items-center justify-between gap-2 px-2">
          <p className="truncate text-xs text-text-muted">{adminName}</p>
          <RoleBadge isSuperAdmin={isSuperAdmin} />
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-2 w-full rounded-lg px-3 py-2 text-start text-sm font-medium text-text-muted transition-colors hover:bg-brand-lavender hover:text-brand-navy"
        >
          {t('admin.nav.signOut')}
        </button>
      </div>
    </>
  )
}

/**
 * Small identity marker so the two roles read as distinct, not just
 * "staff minus some buttons" — gold "Owner Access" for super_admin, a
 * calmer navy "Team Member" pill for staff.
 */
function RoleBadge({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { t } = useTranslation()
  return (
    <span
      className={
        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
        (isSuperAdmin ? 'bg-brand-gold/20 text-brand-gold-dark' : 'bg-brand-navy/10 text-brand-navy')
      }
    >
      {isSuperAdmin ? t('admin.nav.roleBadge.super_admin') : t('admin.nav.roleBadge.staff')}
    </span>
  )
}

/**
 * Workload indicator for bookings that have been created but not yet paid
 * for (`pending_payment`) — the thing an admin most needs to notice at a
 * glance. Hidden entirely at 0 so a quiet day doesn't add visual noise;
 * green for a light, easily-cleared queue; amber once it's built up enough
 * to want attention soon.
 */
function WorkloadBadge({ count }: { count: number | null }) {
  if (!count) return null
  const heavy = count >= 4
  return (
    <span
      className={
        'flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ' +
        (heavy ? 'bg-warning text-white' : 'bg-success text-white')
      }
      title={heavy ? 'Multiple bookings awaiting payment' : 'Bookings awaiting payment'}
    >
      {count}
    </span>
  )
}
