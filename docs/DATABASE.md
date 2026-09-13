# Database reference

Source of truth: `supabase/migrations/20260824000000_phase0_foundation.sql`.
This document is a human-readable map of it — if the two ever disagree,
the migration file wins.

## Tables

| Table | Purpose |
|---|---|
| `admin_profiles` | Staff/admin accounts (1:1 with `auth.users`). A row here — not just an auth account — is what grants dashboard access. |
| `customers` | Renters. `auth_user_id` is nullable to allow a future guest-checkout flow. |
| `drivers` | Customer-supplied driver details **per booking**. Never a company-assigned driver. |
| `vehicle_categories` | Economy / Luxury (currently ~35% / ~65% of the fleet). |
| `vehicles` | The fleet. |
| `vehicle_images` | Public vehicle photos, stored in the `vehicle-images` bucket. |
| `pricing` | List price vs. client price per vehicle, per rental term (daily/weekly/monthly/3-month). |
| `locations` | Pickup/drop-off points — airport or city type, tagged with a `city` column (Dubai, Abu Dhabi — see `docs/ARCHITECTURE.md`'s "Multi-emirate locations" section). |
| `bookings` | The reservation itself. `booking_channel` is constrained to `'website'`. |
| `booking_status_history` | Automatic audit trail of every status change (trigger-populated). |
| `payments` | Payment records tied to a booking. Written by admins/Edge Functions only, never directly by a customer. |
| `complaints` | Structured record of a support issue — the system-side counterpart to a WhatsApp support conversation. Since Phase 3, also carries `internal_notes` (staff-only) and `resolution` (set on close). |
| `audit_logs` | Generic append-only log for sensitive admin-side changes. Populated since Phase 3 by triggers on `vehicles`, `pricing`, `complaints`, and the existing booking-status trigger. |

## Enums

| Enum | Values |
|---|---|
| `admin_role` | `super_admin`, `staff` |
| `vehicle_status` | `available`, `maintenance`, `retired` |
| `pricing_term` | `daily`, `weekly`, `monthly`, `3_month` |
| `booking_status` | `pending_payment`, `confirmed`, `active`, `completed`, `cancelled` |
| `payment_status` | `pending`, `paid`, `failed`, `refunded` |
| `complaint_status` | `open`, `in_progress`, `resolved`, `closed` |
| `location_type` | `airport`, `city` |

## Key constraints worth knowing about

- **`bookings_no_overlap`** — a `gist` exclusion constraint that prevents
  two non-cancelled bookings for the same vehicle from having overlapping
  date ranges. This is the actual double-booking guard, enforced by the
  database, not just application logic.
- **`bookings.booking_channel` check** — pinned to `'website'`; there is
  no schema path for a WhatsApp-sourced booking.
- **`customers.email` unique index** — case-insensitive (`lower(email)`),
  to support matching a returning guest by email later.
- **`pricing (vehicle_id, term)` unique** — one price row per vehicle per
  rental term.
- **`pricing_client_price_le_list_price` check** (Phase 3) — `client_price
  <= list_price`. `client_price` is the real bookable rate; `list_price`
  is the struck-through reference price and can never read lower than
  the real one.

## Row Level Security summary

Every table has RLS enabled. The general shape:

- **Public read** on `vehicle_categories`, `vehicles`, `vehicle_images`,
  `pricing`, `locations` — needed for anonymous browsing before login.
- **Owner read/limited-write** on `customers`, `drivers`, `bookings`,
  `booking_status_history`, `payments`, `complaints` — a signed-in
  customer can see and, where appropriate, create their own records, via
  a `customers.auth_user_id = auth.uid()` check (traversed through the
  parent booking for child tables like `drivers` and `payments`).
- **Admin full access** everywhere, via the `is_admin()` helper function
  (checks for a row in `admin_profiles`).
- **No client write path for `payments`** — still admin/service-role
  only, on purpose, so payment state can't be forged from the browser.
  `audit_logs` gained one narrow insert policy in Phase 3 — admins may
  insert rows attributed to themselves (`actor_id = auth.uid()`) or
  system-attributed rows (`actor_id is null`); this exists only so the
  Phase 3 triggers, which run as the acting admin rather than a
  privileged role, can succeed under RLS. There is still no general
  client write path to `audit_logs`.

## Phase 3 additions

- **`vehicle_operational_status` view** — a `security_invoker = true`
  view (enforces RLS as the querying admin, not the view owner)
  classifying each vehicle's *current* state:
  available / reserved / rented / maintenance / unavailable. This is
  **not** a second availability engine — it answers "what is this
  vehicle doing right now", never "is it bookable for date range X".
  `available_vehicles()` (Phase 1) remains the only function that
  answers that question.
- **Audit triggers** — `vehicles_audit`, `pricing_audit`, and
  `complaints_audit` write to `audit_logs` on insert/update. The existing
  `handle_booking_status_change()` trigger function (Phase 0) was
  extended in place to also write an `audit_logs` row alongside its
  original `booking_status_history` insert — same trigger binding, no
  parallel mechanism.
- **New indexes** for admin list/filter queries: `payments_status_idx`,
  `complaints_status_idx`, `audit_logs_created_at_idx`,
  `bookings_created_at_idx`.

## Storage buckets

| Bucket | Public? | Who can write | Who can read |
|---|---|---|---|
| `vehicle-images` | Yes | Admins only | Anyone |
| `driver-documents` | **No** | The owning customer (into their own booking's folder) | Admins only |

Path convention for `driver-documents`: `<booking_id>/<filename>` — the
storage policy checks that the first path segment matches a booking the
uploading customer owns.

## Regenerating TypeScript types

`src/types/database.ts` is currently hand-written and kept in sync by
hand with the migration. Once this project is linked to a real Supabase
project, replace it with the generated version:

```bash
supabase gen types typescript --linked > src/types/database.ts
```
