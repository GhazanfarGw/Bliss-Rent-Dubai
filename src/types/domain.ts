import type { Database } from '@/types/database'

type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type CategoryRow = Database['public']['Tables']['vehicle_categories']['Row']
type ImageRow = Database['public']['Tables']['vehicle_images']['Row']
type PricingRow = Database['public']['Tables']['pricing']['Row']
type LocationRow = Database['public']['Tables']['locations']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type DriverRow = Database['public']['Tables']['drivers']['Row']
type BookingRow = Database['public']['Tables']['bookings']['Row']
type BookingStatusHistoryRow = Database['public']['Tables']['booking_status_history']['Row']
type PaymentRow = Database['public']['Tables']['payments']['Row']
type ComplaintRow = Database['public']['Tables']['complaints']['Row']
type ComplaintMessageRow = Database['public']['Tables']['complaint_messages']['Row']
type AuditLogRow = Database['public']['Tables']['audit_logs']['Row']
type EmailLogRow = Database['public']['Tables']['email_log']['Row']
type AdminProfileRow = Database['public']['Tables']['admin_profiles']['Row']
type OperationalStatusRow = Database['public']['Views']['vehicle_operational_status']['Row']

/**
 * A vehicle enriched with its publicly-readable related data, shaped the
 * way our Supabase select-with-embeds queries return it. Only ever built
 * from tables/columns that are public per Phase 0 RLS — see
 * src/features/booking/api.ts.
 */
export interface VehicleWithDetails extends VehicleRow {
  vehicle_categories: CategoryRow | null
  vehicle_images: ImageRow[]
  pricing: PricingRow[]
}

/**
 * A vehicle returned from a dated search, additionally tagged with whether
 * it's actually free for the searched date range. `false` means it has an
 * overlapping booking for those specific dates — it still appears in
 * results (so the customer can see the whole fleet and try other dates)
 * but is shown as "Reserved" and can't be booked.
 */
export interface VehicleSearchResult extends VehicleWithDetails {
  isAvailable: boolean
}

export type Location = LocationRow

export interface SearchCriteria {
  startDate: string
  endDate: string
  pickupLocationId: string
  dropoffLocationId: string
  /**
   * Optional pickup time-of-day ("HH:mm", 24h), carried through the
   * search bar and checkout draft purely as customer-facing/ops metadata —
   * see src/lib/timeOptions.ts. Not used by availability, the no-overlap
   * exclusion constraint, or pricing (all stay day-count based,
   * unchanged), and not required for a criteria to be "complete" (see
   * isCompleteCriteria in searchParams.ts). There is deliberately no
   * returnTime — only pickup time is customer-facing.
   */
  pickupTime?: string
}

export interface VehicleFilters {
  categoryId: string | null
  brand: string | null
  transmission: string | null
  /** Only meaningful once dates are chosen — see VehicleSearchResult. */
  availability: 'available' | 'reserved' | null
}

export type SortOption = 'price_asc' | 'price_desc'

export const EMPTY_FILTERS: VehicleFilters = {
  categoryId: null,
  brand: null,
  transmission: null,
  availability: null,
}

// ---------------------------------------------------------------------------
// Phase 2 — Booking & Checkout
// ---------------------------------------------------------------------------

/** What the Customer Details step (Step 4) collects. Matches the create-booking Edge Function's `customer` shape exactly — see _shared/validation.ts's CustomerInput. */
export interface CustomerDraft {
  firstName: string
  lastName: string
  email: string
  phone: string
}

/**
 * What the Driver Details step (Step 5) collects. The customer supplies
 * their own driver — see docs/ARCHITECTURE.md. `isSameAsCustomer` backs
 * the "Who will drive the car?" toggle: when true, the driver's
 * firstName/lastName/phone here are ignored in favor of the CURRENT
 * customer draft (computed on demand — see effectiveDriverIdentity below
 * — never copied in, so editing Step 4 afterwards can never leave a
 * stale driver name behind).
 */
export interface DriverDraft {
  isSameAsCustomer: boolean
  firstName: string
  lastName: string
  phone: string
  licenseNumber: string
  licenseCountry: string
  licenseExpiry: string
}

export const EMPTY_CUSTOMER_DRAFT: CustomerDraft = { firstName: '', lastName: '', email: '', phone: '' }
export const EMPTY_DRIVER_DRAFT: DriverDraft = {
  isSameAsCustomer: true,
  firstName: '',
  lastName: '',
  phone: '',
  licenseNumber: '',
  licenseCountry: '',
  licenseExpiry: '',
}

/** The driver identity actually used for validation/submission/display — the customer's own info when "I am the driver" is selected (always freshly computed, never a stale copy), or the driver's own typed fields otherwise. */
export function effectiveDriverIdentity(
  customer: CustomerDraft,
  driver: DriverDraft,
): { firstName: string; lastName: string; phone: string } {
  return driver.isSameAsCustomer
    ? { firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone }
    : { firstName: driver.firstName, lastName: driver.lastName, phone: driver.phone }
}

/**
 * The in-progress checkout state for one vehicle, persisted to
 * sessionStorage (see useCheckoutDraft.ts) so it survives a refresh or
 * back/forward navigation across the multi-step flow without needing a
 * server-side session — this is a guest checkout, there is no auth
 * session to hang state off of.
 */
export interface CheckoutDraft {
  vehicleId: string
  criteria: SearchCriteria
  customer: CustomerDraft
  driver: DriverDraft
}

/** Result of a successful create-booking call — everything the Summary/Payment/Confirmation steps need, with no re-fetch required. */
export interface BookingCreationResult {
  bookingId: string
  bookingReference: string
  customerId: string
  driverId: string
  paymentId: string
  status: string
  term: string
  unitPrice: number
  totalPrice: number
  currency: string
  currencyCode?: string
  days: number
}

/** Everything the Confirmation page displays, assembled once at payment-confirmation time and stored in sessionStorage — see checkoutApi.ts. Guest checkout means there is no session to re-query this from later, so it is captured here rather than re-fetched. */
export interface BookingConfirmationSnapshot {
  bookingReference: string
  bookingId: string
  vehicleMake: string
  vehicleModel: string
  startDate: string
  endDate: string
  pickupLocationName: string
  dropoffLocationName: string
  customerName: string
  driverName: string
  totalPrice: number
  currency: string
  paymentStatus: string
  bookingStatus: string
}

// ---------------------------------------------------------------------------
// Phase 3 — Admin Dashboard & Operations
// ---------------------------------------------------------------------------

export type AdminProfile = AdminProfileRow

/** A booking enriched with the joined rows the admin list/detail views need — all reachable under the existing "admins manage X" RLS policies, no new privileged path. */
export interface AdminBookingWithDetails extends BookingRow {
  customers: CustomerRow | null
  vehicles: (VehicleRow & { vehicle_categories: CategoryRow | null }) | null
  pickup_location: LocationRow | null
  dropoff_location: LocationRow | null
  drivers: DriverRow[]
  payments: PaymentRow[]
}

export type AdminBookingStatusHistoryEntry = BookingStatusHistoryRow

export interface AdminCustomerWithStats extends CustomerRow {
  booking_count: number
  active_booking_count: number
}

export interface AdminVehicleWithDetails extends VehicleRow {
  vehicle_categories: CategoryRow | null
  vehicle_images: ImageRow[]
  pricing: PricingRow[]
  operational_status: OperationalStatusRow['operational_status']
}

export type AdminPaymentWithDetails = PaymentRow & {
  bookings: (BookingRow & { customers: CustomerRow | null }) | null
}

export type AdminComplaintWithDetails = ComplaintRow & {
  customers: CustomerRow | null
  bookings: BookingRow | null
}

/** Support Chat thread row (see complaint_messages, 20261007000000_support_chat.sql) — read/written straight off the table, no join. */
export type AdminComplaintMessage = ComplaintMessageRow

export type AdminAuditLogEntry = AuditLogRow

// ---------------------------------------------------------------------------
// Phase 9J — Admin Email Management dashboard
// ---------------------------------------------------------------------------

/** Read-only view onto email_log — the Email Log tab reads this table exactly as it was created in 9C, no new columns. */
export type AdminEmailLogEntry = EmailLogRow

/**
 * One (category, eventType) pair the preview/test-send tool
 * (supabase/functions/preview-send-email) can render — mirrors
 * previewRenderer.ts's PreviewCatalogEntry exactly. Fetched from that
 * Edge Function's 'catalog' mode rather than hand-maintained here, so
 * this dashboard can never drift out of sync with what the tool actually
 * supports.
 */
export interface AdminEmailPreviewCatalogEntry {
  category: 'customer' | 'admin' | 'complaint'
  eventType: string
  label: string
}

// ---------------------------------------------------------------------------
// Phase 6 — Booking Engine & Reservation System (booking retrieval)
// ---------------------------------------------------------------------------

/**
 * Result of the guest-safe lookup_booking_for_customer() lookup — a small,
 * non-sensitive summary (no driver license/document fields, no phone),
 * deliberately the same shape of information already shown on
 * ConfirmationPage. See src/features/booking/lookupApi.ts. vehiclePlate is
 * included (unlike the original Phase 6 shape) so the merged Manage
 * Booking page can hand it straight to ExtendRentalSection without asking
 * the customer to type it again.
 */
export interface BookingLookupResult {
  bookingId: string
  bookingReference: string
  bookingStatus: string
  startDate: string
  endDate: string
  totalPrice: number
  currency: string
  vehicleId: string
  vehicleMake: string
  vehicleModel: string
  vehiclePlate: string
  pickupLocationId: string
  dropoffLocationId: string
  pickupLocationName: string
  dropoffLocationName: string
  customerName: string
  /** Added for the checkout resume-payment fix — lets Manage Booking route a pending_payment booking straight back into the Payment step. */
  paymentId: string
  paymentStatus: string
  createdAt: string
}

/** Draft shape for the admin Add/Edit Vehicle form. Mirrors vehicles' writable columns exactly — see adminFleetApi.ts. */
export interface VehicleDraft {
  categoryId: string
  make: string
  model: string
  modelYear: string
  transmission: string
  seats: string
  plateNumber: string
  status: VehicleRow['status']
}

export const EMPTY_VEHICLE_DRAFT: VehicleDraft = {
  categoryId: '',
  make: '',
  model: '',
  modelYear: String(new Date().getFullYear()),
  transmission: 'automatic',
  seats: '5',
  plateNumber: '',
  status: 'available',
}

/** Draft shape for one pricing-ladder row in the admin Pricing page. */
export interface PricingDraft {
  id: string | null
  term: PricingRow['term']
  listPrice: string
  clientPrice: string
}

// ---------------------------------------------------------------------------
// Phase 7 — Rental Extension & Extension Payments
// ---------------------------------------------------------------------------

type BookingExtensionRow = Database['public']['Tables']['booking_extensions']['Row']
type ExtensionPricingSettingsRow = Database['public']['Tables']['extension_pricing_settings']['Row']
type ExtensionPenaltySettingsRow = Database['public']['Tables']['extension_penalty_settings']['Row']
type VehicleReassignmentRow = Database['public']['Tables']['vehicle_reassignments']['Row']

/**
 * An extension record enriched with the joined rows the admin list/detail
 * views need — same "admins manage X" RLS reach as every other admin
 * screen, nothing privileged beyond what booking_extensions' own SELECT
 * policy already allows. The original booking is included so the screen
 * can show its (derived, never stored) reference — see
 * src/lib/bookingReference.ts.
 */
export interface AdminExtensionWithDetails extends BookingExtensionRow {
  bookings: (BookingRow & { vehicles: (VehicleRow & { vehicle_categories: CategoryRow | null }) | null; customers: CustomerRow | null }) | null
  /** The replacement vehicle a conflicting future booking was moved to, if any — joined in for display, never guessed. */
  replacement_vehicle?: VehicleRow | null
}

/**
 * Phase 7 (direct Super Admin extension workflow) — a booking that is
 * genuinely being rented right now, for the Extensions page's "Current
 * Rented Cars" list. Deliberately lighter than AdminBookingWithDetails
 * (no drivers/pickup/dropoff — that list never shows them): only the
 * customer, exact vehicle, and payment rows this list and the Extend
 * Rental panel actually need.
 */
export interface AdminCurrentRentedCar extends BookingRow {
  customers: CustomerRow | null
  vehicles: (VehicleRow & { vehicle_categories: CategoryRow | null; pricing: PricingRow[] }) | null
  payments: PaymentRow[]
}

export type ExtensionPricingSettingsRecord = ExtensionPricingSettingsRow

/**
 * Phase 7 (booking reassignment respec) — mirrors ExtensionPricingSettingsRecord.
 * See src/lib/extensionPenalty.ts.
 */
export type ExtensionPenaltySettingsRecord = ExtensionPenaltySettingsRow

/** One traceability row for a booking whose vehicle was reassigned to resolve an extension conflict. */
export type VehicleReassignmentRecord = VehicleReassignmentRow

/** Draft shape for the "record a confirmed extension" admin form. */
export interface ExtensionRequestDraft {
  requestedReturnDate: string
  supportConfirmedBy: string
  supportConfirmationNote: string
  paymentMethod: 'cash' | 'online'
}

export const EMPTY_EXTENSION_DRAFT: ExtensionRequestDraft = {
  requestedReturnDate: '',
  supportConfirmedBy: '',
  supportConfirmationNote: '',
  paymentMethod: 'cash',
}

/** Result shape for the guest-safe Extend Rental verification step (verify_booking_for_extension). */
export interface ExtendRentalVerificationResult {
  bookingId: string
  bookingReference: string
  vehicleMake: string
  vehicleModel: string
  vehiclePlate: string
  currentReturnDate: string
  bookingStatus: string
}
