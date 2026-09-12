// Phase 9F — admin recipient resolution.
//
// "Use existing admin email configuration where available" (the 9F
// instruction): audited this schema and there is no dedicated
// notification-email setting anywhere — no `site_settings` row, no
// `admin_profiles.email` column. admin_profiles only ever stored
// `id, full_name, role, is_active` (see
// supabase/migrations/20260824000000_phase0_foundation.sql /
// 20260901000000_staff_account_control.sql); the email address for a
// staff/admin account lives only in Supabase Auth (`auth.users`), the
// same place admin-create-staff.ts already reads/writes it. So "existing
// admin email configuration" here means exactly that: every currently
// active admin account (admin_profiles.is_active = true), resolved to
// its real Auth email — not a new settings field invented for this
// phase.
//
// DEFAULT RECIPIENT SET (flagged in the completion report, not a silent
// choice): both `staff` and `super_admin` roles receive these emails,
// not just the owner. Every route these events relate to (Bookings,
// Extensions, Payments) is already "All admins" access in this app (see
// src/App.tsx / the Phase 8 route audit) — restricting operational
// emails to super_admin only would notify a narrower audience than the
// one who can already act on these pages today.
//
// Recipient resolution needs TWO round trips because the data lives in
// two different places: admin_profiles (read via the ordinary
// postgrest-style client, same as every other admin*Api.ts file) for who
// is currently active, and Supabase Auth (via `auth.admin.getUserById`,
// service-role only) for each one's actual email. Both are
// dependency-injected so this stays unit-testable without a real
// database or a real Auth instance — same convention as every other
// `_shared/email` module.

export interface ActiveAdminRow {
  id: string
  full_name: string
}

/** The minimal slice of the supabase-js client surface this module needs — narrow on purpose, same convention as bookingEmailData.ts's BookingEmailDataSource. */
export interface ActiveAdminsSource {
  from(table: 'admin_profiles'): {
    select(columns: string): {
      eq(column: string, value: boolean): Promise<{ data: ActiveAdminRow[] | null; error: { message: string } | null }>
    }
  }
}

/** Resolves one admin's email from their Supabase Auth user id. Returns null (never throws) when the lookup fails or the user has no email — a single missing/unreachable admin must never take down the whole recipient list. */
export type GetAdminEmailFn = (id: string) => Promise<string | null>

export interface AdminRecipient {
  /** admin_profiles.id — also used as the per-recipient idempotency discriminator (see sendAdminOperationalEmail.ts). */
  id: string
  name: string
  email: string
}

export class AdminRecipientsSourceError extends Error {}

export async function resolveAdminRecipients(
  source: ActiveAdminsSource,
  getAdminEmail: GetAdminEmailFn,
): Promise<AdminRecipient[]> {
  const { data, error } = await source.from('admin_profiles').select('id, full_name').eq('is_active', true)
  if (error) {
    throw new AdminRecipientsSourceError(`resolveAdminRecipients: ${error.message}`)
  }

  const rows = data ?? []
  const recipients: AdminRecipient[] = []
  const seenEmails = new Set<string>()

  for (const row of rows) {
    const email = (await getAdminEmail(row.id))?.trim().toLowerCase()
    if (!email) continue
    // Defensive dedupe — two admin_profiles rows are never expected to
    // share an Auth user id (admin_profiles.id IS that user's id), but
    // guarding against a duplicate email keeps a data anomaly from ever
    // sending the same admin two copies of the same operational email.
    if (seenEmails.has(email)) continue
    seenEmails.add(email)
    recipients.push({ id: row.id, name: row.full_name?.trim() || 'Admin', email })
  }

  return recipients
}
