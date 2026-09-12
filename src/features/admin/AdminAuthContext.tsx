import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import type { AdminProfile } from '@/types/domain'

/**
 * Admin auth built entirely on the existing Supabase Auth + admin_profiles
 * foundation from Phase 0 — there is no second authentication system. A
 * Supabase Auth session alone does not grant dashboard access: only a
 * matching row in `admin_profiles` does (see docs/DATABASE.md). This
 * context is the single place that checks for that row, so every admin
 * page can trust `adminProfile` without re-querying it.
 */
interface AdminAuthState {
  loading: boolean
  session: Session | null
  adminProfile: AdminProfile | null
  /** Set only when a real Auth session exists but has no admin_profiles row — lets the login page show a clear "not authorized" message instead of a silent redirect loop. */
  notAuthorized: boolean
  /** Set when a real admin_profiles row exists but has been suspended (is_active = false) from the Staff Accounts screen — distinct from notAuthorized so the login page can show "your account was suspended" rather than "this account has no admin access". */
  suspended: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthState | null>(null)

async function loadAdminProfile(userId: string): Promise<AdminProfile | null> {
  const { data, error } = await supabase.from('admin_profiles').select('*').eq('id', userId).maybeSingle()
  // A permission/RLS error here means "not an admin", not a crash — the
  // dashboard treats both the same way: no access.
  if (error) return null
  return data
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const {
        data: { session: current },
      } = await supabase.auth.getSession()
      if (cancelled) return
      setSession(current)
      if (current) {
        const profile = await loadAdminProfile(current.user.id)
        if (!cancelled) setAdminProfile(profile)
      }
      if (!cancelled) setLoading(false)
    }
    void init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) {
        void loadAdminProfile(nextSession.user.id).then((profile) => {
          if (!cancelled) setAdminProfile(profile)
        })
      } else {
        setAdminProfile(null)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setAdminProfile(null)
  }

  async function refreshProfile() {
    if (!session) return
    const profile = await loadAdminProfile(session.user.id)
    setAdminProfile(profile)
  }

  const value: AdminAuthState = {
    loading,
    session,
    adminProfile,
    notAuthorized: Boolean(session) && !loading && !adminProfile,
    suspended: Boolean(adminProfile) && adminProfile?.is_active === false,
    signOut,
    refreshProfile,
  }

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  return ctx
}
