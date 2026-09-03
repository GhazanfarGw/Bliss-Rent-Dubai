// Phase 9F — the admin-email equivalent of 9D's manageBookingLink.ts.
// Every admin operational email's CTA (renderAdminLayout's dashboardUrl,
// via strings.admin.openDashboard) points at a real, already-existing
// admin route (src/App.tsx) — never an invented one. The caller decides
// which path (`/admin/bookings/:id` for a specific booking,
// `/admin/extensions` for the pending-requests queue), this just joins
// it onto the configured site base URL the same way buildManageBookingUrl
// does.
export function buildAdminDashboardUrl(siteBaseUrl: string, path: string): string {
  const base = siteBaseUrl.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}
