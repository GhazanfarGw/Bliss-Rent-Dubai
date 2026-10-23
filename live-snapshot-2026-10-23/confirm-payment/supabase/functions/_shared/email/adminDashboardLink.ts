export function buildAdminDashboardUrl(siteBaseUrl: string, path: string): string {
  const base = siteBaseUrl.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}
