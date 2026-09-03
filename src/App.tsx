import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/features/shared/Layout'
import { RouteNavigationShell } from '@/features/shared/RouteNavigationShell'
import { HomePage } from '@/features/booking/HomePage'
import { SearchResultsPage } from '@/features/booking/SearchResultsPage'
import { VehicleDetailPage } from '@/features/booking/VehicleDetailPage'
import { CustomerDetailsPage } from '@/features/booking/checkout/CustomerDetailsPage'
import { DriverDetailsPage } from '@/features/booking/checkout/DriverDetailsPage'
import { BookingSummaryPage } from '@/features/booking/checkout/BookingSummaryPage'
import { PaymentPage } from '@/features/booking/checkout/PaymentPage'
import { ConfirmationPage } from '@/features/booking/checkout/ConfirmationPage'
import { ManageBookingPage } from '@/features/booking/ManageBookingPage'
import { AboutPage } from '@/features/content/AboutPage'
import { CarTypesPage } from '@/features/content/CarTypesPage'
import { LocationsPage } from '@/features/content/LocationsPage'
import { FaqPage } from '@/features/content/FaqPage'
import { ContactPage } from '@/features/content/ContactPage'
import { PrivacyPolicyPage } from '@/features/content/PrivacyPolicyPage'
import { CookiePolicyPage } from '@/features/content/CookiePolicyPage'
import { BookingTermsPage } from '@/features/content/BookingTermsPage'
import { AdminAuthProvider } from '@/features/admin/AdminAuthContext'
import { AdminRoute } from '@/features/admin/AdminRoute'
import { SuperAdminRoute } from '@/features/admin/SuperAdminRoute'
import { AdminLoginPage } from '@/features/admin/AdminLoginPage'
import { AdminLayout } from '@/features/admin/AdminLayout'
import { DashboardPage } from '@/features/admin/dashboard/DashboardPage'
import { BookingsListPage } from '@/features/admin/bookings/BookingsListPage'
import { BookingDetailPage } from '@/features/admin/bookings/BookingDetailPage'
import { FleetListPage } from '@/features/admin/fleet/FleetListPage'
import { VehicleFormPage } from '@/features/admin/fleet/VehicleFormPage'
import { AvailabilityCalendarPage } from '@/features/admin/availability/AvailabilityCalendarPage'
import { CustomersListPage } from '@/features/admin/customers/CustomersListPage'
import { CustomerDetailPage } from '@/features/admin/customers/CustomerDetailPage'
import { PaymentsListPage } from '@/features/admin/payments/PaymentsListPage'
import { ExtensionsListPage } from '@/features/admin/extensions/ExtensionsListPage'
import { ComplaintsListPage } from '@/features/admin/complaints/ComplaintsListPage'
import { ComplaintDetailPage } from '@/features/admin/complaints/ComplaintDetailPage'
import { PricingManagementPage } from '@/features/admin/pricing/PricingManagementPage'
import { EmailManagementPage } from '@/features/admin/emails/EmailManagementPage'
import { AuditLogPage } from '@/features/admin/auditlog/AuditLogPage'
import { StaffAccountsPage } from '@/features/admin/staff/StaffAccountsPage'
import { AdminSettingsPage } from '@/features/admin/settings/AdminSettingsPage'

/**
 * Phase 3 — Admin Dashboard & Operations, built on Phase 0's admin_profiles
 * / is_admin() / RLS foundation and Phase 1–2's booking, pricing, and
 * availability logic (all reused, none duplicated — see
 * supabase/migrations/20260827000000_phase3_admin_dashboard.sql).
 * AdminAuthProvider wraps the whole app (cheap: it only checks the
 * session/profile once) so /admin/login can also read auth state; every
 * other /admin/* route is wrapped in AdminRoute.
 *
 * Still out of scope, deliberately: WhatsApp Business API integration,
 * production deployment, advanced analytics, automated marketing, other
 * emirates, and new business features — those are later phases.
 *
 * Phase 6 — Booking Engine & Reservation System adds exactly one route,
 * /manage-booking (ManageBookingPage): a guest-safe "check my booking"
 * lookup by reference + email, the one genuine gap the Phase 6 audit
 * found (see supabase/migrations/20260829000000_phase6_booking_lookup.sql).
 * Every other Phase 6 in-scope item already existed from Phases 0–5 and
 * is reused unchanged.
 *
 * Staff Account Control adds /admin/staff (StaffAccountsPage), the
 * super_admin-only screen for adding, suspending/reactivating, and
 * promoting/demoting staff accounts — see
 * supabase/migrations/20260901000000_staff_account_control.sql and
 * supabase/functions/admin-create-staff.
 *
 * Phase 7 adds /admin/extensions (ExtensionsListPage, global extension
 * history) — the per-booking record/process workflow itself lives inside
 * BookingDetailPage (RentalExtensionsSection), not its own route. Visible
 * to any admin (is_admin()), same as bookings/payments — processing an
 * extension is a day-to-day staff operation, not an owner-only one; only
 * the extension PRICING POLICY (in AdminSettingsPage) is owner-only. See
 * supabase/migrations/20260902000000_phase7_rental_extensions.sql.
 *
 * Phase 7 (booking reassignment respec) originally added a separate
 * /extend-rental page — the new customer self-service request channel,
 * verified by booking reference + vehicle number. It shares the exact
 * same admin-side engine as the WhatsApp/support channel; see
 * supabase/migrations/20260903000000_phase7_booking_reassignment.sql.
 *
 * Follow-up (same day, requested directly in chat): /extend-rental was
 * merged INTO /manage-booking — one single field (reference OR vehicle
 * plate, either alone) finds the booking, and the extend-request form
 * (ExtendRentalSection) now appears inline on that same page when the
 * booking is in a state that can still be extended. /extend-rental keeps
 * working as a redirect to /manage-booking for anyone with the old link.
 * See lookupApi.ts and the lookup_booking_for_customer() migration.
 */
function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <RouteNavigationShell>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchResultsPage />} />
              <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
              <Route path="/checkout/:id/customer" element={<CustomerDetailsPage />} />
              <Route path="/checkout/:id/driver" element={<DriverDetailsPage />} />
              <Route path="/checkout/:id/summary" element={<BookingSummaryPage />} />
              <Route path="/checkout/:id/payment/:bookingId" element={<PaymentPage />} />
              <Route path="/checkout/:id/confirmation/:bookingId" element={<ConfirmationPage />} />
              <Route path="/manage-booking" element={<ManageBookingPage />} />
              <Route path="/extend-rental" element={<Navigate to="/manage-booking" replace />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/car-types" element={<CarTypesPage />} />
              <Route path="/locations" element={<LocationsPage />} />
              <Route path="/faqs" element={<FaqPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/cookie-policy" element={<CookiePolicyPage />} />
              <Route path="/booking-terms" element={<BookingTermsPage />} />
            </Route>

            <Route path="/admin/login" element={<AdminLoginPage />} />

            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="bookings" element={<BookingsListPage />} />
              <Route path="bookings/:id" element={<BookingDetailPage />} />
              <Route path="fleet" element={<FleetListPage />} />
              <Route path="fleet/new" element={<VehicleFormPage />} />
              <Route path="fleet/:id" element={<VehicleFormPage />} />
              <Route path="availability" element={<AvailabilityCalendarPage />} />
              <Route path="customers" element={<CustomersListPage />} />
              <Route path="customers/:id" element={<CustomerDetailPage />} />
              <Route path="payments" element={<PaymentsListPage />} />
              <Route path="extensions" element={<ExtensionsListPage />} />
              <Route path="complaints" element={<ComplaintsListPage />} />
              <Route path="complaints/:id" element={<ComplaintDetailPage />} />
              <Route path="pricing" element={<PricingManagementPage />} />
              <Route path="emails" element={<EmailManagementPage />} />
              <Route
                path="audit-log"
                element={
                  <SuperAdminRoute>
                    <AuditLogPage />
                  </SuperAdminRoute>
                }
              />
              <Route
                path="staff"
                element={
                  <SuperAdminRoute>
                    <StaffAccountsPage />
                  </SuperAdminRoute>
                }
              />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>
          </Routes>
        </RouteNavigationShell>
      </AdminAuthProvider>
    </BrowserRouter>
  )
}

export default App
