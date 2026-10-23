export interface ActiveAdminRow {
  id: string
  full_name: string
}

export interface ActiveAdminsSource {
  from(table: 'admin_profiles'): {
    select(columns: string): {
      eq(column: string, value: boolean): Promise<{ data: ActiveAdminRow[] | null; error: { message: string } | null }>
    }
  }
}

export type GetAdminEmailFn = (id: string) => Promise<string | null>

export interface AdminRecipient {
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
    if (seenEmails.has(email)) continue
    seenEmails.add(email)
    recipients.push({ id: row.id, name: row.full_name?.trim() || 'Admin', email })
  }

  return recipients
}
