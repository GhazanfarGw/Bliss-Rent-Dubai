# Admin dashboard feature (Phase 3)

Staff-facing operations dashboard, routed under `/admin/*` in `src/App.tsx`.
Built entirely on the Phase 0 `admin_profiles` / `is_admin()` / RLS
foundation — see `docs/ARCHITECTURE.md` ("Phase 3 — admin dashboard &
operations") for the full picture and `docs/DATABASE.md` for the schema
additions.

```
AdminAuthContext.tsx    Session + admin_profiles lookup — the one place that decides "is this an admin"
AdminRoute.tsx          Route guard used by every /admin/* route except /admin/login
AdminLoginPage.tsx      Email/password sign-in via existing Supabase Auth
AdminLayout.tsx         Sidebar + header shell, nested routes render via <Outlet/>
adminApi.ts             Dashboard KPIs + recent activity, and the shared AdminApiError class
shared/                 AdminPageHeader, AdminTabs, AdminStatusBadge — reused across every feature below
dashboard/              Dashboard overview
bookings/               Booking management + detail
fleet/                  Fleet management (vehicles, images, status)
availability/           Read-only availability calendar (reuses real booking rows, no second engine)
customers/              Customer management
payments/               Payments — READ ONLY by design, see adminPaymentsApi.ts
complaints/             Complaints / support
pricing/                Pricing ladder management
auditlog/               Audit log (read-only)
settings/               Own profile + super_admin-only staff directory
```
