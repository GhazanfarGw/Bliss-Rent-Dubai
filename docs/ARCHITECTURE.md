# Architecture

## Business rules this architecture is built around

These were explicitly updated from the original business-model document
and MUST be respected by every future phase:

| Rule | Decision |
|---|---|
| **Website = Booking** | Customers book only through the website. There is no WhatsApp booking flow, and none of the schema, API, or UI should ever imply one. |
| **WhatsApp = Complaints/Support** | WhatsApp is used only for complaints, support, rental issues, and general communication during/after a rental. The `complaints` table is where those conversations get logged in the system; no booking table references WhatsApp. |
| **Customer = Provides Driver** | The company does not provide drivers. The `drivers` table captures driver details the *customer* supplies per booking. There is no company-driver assignment table anywhere in the schema. |
| **Coverage = Dubai + Abu Dhabi** | `locations` has a `city` column (Dubai, Abu Dhabi) — see the "Multi-emirate locations" section below. Full UAE-wide coverage beyond these two emirates is still out of scope until a later "Expand" phase. |

## Customer journey (what the schema supports, not yet what's built)

```
Website
  → Select Dates
  → Select City (Dubai or Abu Dhabi), then Location
  → Select Pickup
  → Select Drop-off
  → Select Vehicle
  → Enter Customer/Driver Details
  → Payment
  → Booking Confirmation
  → Vehicle Handover
  → Rental
  → WhatsApp Support for Complaints
  → Vehicle Return
```

Phase 0 does not build this UI. It builds the `bookings`, `drivers`,
`payments`, `booking_status_history`, and `complaints` tables (plus RLS)
that this journey will read and write against in later phases.

## System overview

```
┌─────────────────────┐        ┌──────────────────────────┐
│   Frontend (Vite)    │        │  Supabase Edge Functions  │
│  React + TS + Tailwind│──────▶│  (service-role, TS/Deno)  │
│  uses ANON key only  │        │  privileged writes only   │
└──────────┬───────────┘        └─────────────┬────────────┘
           │  anon key + RLS                   │  service role key
           ▼                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                Supabase (single backend platform)             │
│  PostgreSQL  ·  Auth  ·  Storage  ·  Row Level Security       │
└─────────────────────────────────────────────────────────────┘
```

**Why this shape, not a separate Node/Express API:** the whole backend
requirement is "use Supabase" — Postgres, Auth, and Storage cover almost
everything a booking platform needs directly from the client, with every
table protected by Row Level Security (see `supabase/migrations/`). The
handful of operations that must never trust the client directly —
confirming a payment, or an admin-only bulk action — run instead as
**Supabase Edge Functions** using the service-role key, which lives only
on the server side and is never shipped to the frontend. This avoids
standing up and hosting a second backend service for what is, at this
stage, a small set of privileged operations. If that set grows
substantially, revisit this decision — it is not irreversible.

## Frontend structure

```
src/
  lib/              Supabase client, typed env access — nothing else
  types/            Database types (mirrors the Supabase schema)
  features/
    booking/        Customer booking journey — NOT built yet (Phase 1+)
    admin/           Admin dashboard — NOT built yet (Phase 1+)
    shared/          Cross-cutting pieces (currently just the Phase 0 status screen)
```

`features/booking` and `features/admin` are placeholders on purpose —
Phase 0's job is the foundation underneath them, not the screens
themselves.

## Admin dashboard scope (for later phases)

The `admin_profiles` role foundation and RLS policies already support an
admin dashboard covering: vehicles/fleet, vehicle availability, bookings,
customers, customer-submitted driver information, payments, pricing,
pickup/handover, returns, complaints/support, reports, and system
settings. None of the UI for this exists yet.

## Security model

- **Row Level Security is mandatory on every table.** Nothing is
  readable or writable from the client except through an explicit RLS
  policy — see `supabase/migrations/20260824000000_phase0_foundation.sql`.
- **Two credential tiers:**
  - *Anon key* (public, `VITE_SUPABASE_ANON_KEY`) — used by the frontend.
    Every request still passes through RLS.
  - *Service role key* (`SUPABASE_SERVICE_ROLE_KEY`) — used only inside
    Edge Functions, bypasses RLS entirely, and must never be exposed to
    the frontend or committed to source control.
- **Driver documents are private.** The `driver-documents` Storage bucket
  is non-public; only the uploading customer (write) and admins (read)
  can touch it, enforced by storage policies, not just app logic. Vehicle
  images are the only public bucket.
- **Booking channel is enforced at the schema level.** `bookings.booking_channel`
  has a `check` constraint pinning it to `'website'` — a defensive measure
  so a future integration mistake can't silently insert a WhatsApp-sourced
  booking.

## Phase 2 — booking creation & payment (implemented)

The two privileged Edge Functions anticipated above are now real:

- **`create-booking`** — the only way a booking is created. Computes the
  authoritative price server-side (calling the exact same
  `resolveTermForDays`/`quoteForDays` functions from `src/lib/pricing.ts`
  that Phase 1 built for on-site display — one pricing implementation,
  reused, not duplicated), then calls the `create_booking` SQL function
  (see `supabase/migrations/20260826000000_phase2_booking_checkout.sql`),
  which atomically creates the customer/booking/driver/payment rows in
  one transaction.
- **`confirm-payment`** — resolves a pending payment to paid/failed and
  advances the booking to `confirmed` on success. Idempotent by design.

**Authentication decision: guest checkout, no login wall.** Phase 0
deliberately left `customers.auth_user_id` nullable and gave
`customers.email` a case-insensitive unique index "to support matching a
returning guest by email later" (see `docs/DATABASE.md`). Phase 2 uses
exactly that: a customer is matched/created by email inside
`create_booking`, with no Supabase Auth session required. This is why
booking creation and payment confirmation both have to go through
SECURITY DEFINER SQL functions called only from Edge Functions — there's
no `auth.uid()` for the normal per-row RLS policies to check. Both SQL
functions are explicitly revoked from `anon`/`authenticated` so they are
never reachable by a raw `supabase.rpc()` call from the browser — only
from server code holding the service-role key.

**Payment provider: TEST ONLY, pending a real gateway.** No payment
gateway has been selected by the business yet, so
`supabase/functions/_shared/testPaymentProvider.ts` simulates one behind
a small, swappable contract (decide an outcome → return a provider
reference). It is prominently labeled TEST ONLY in code and in the UI,
never presented as a real charge. Swapping in a real gateway later means
replacing that one file's decision logic with a real API call/webhook
verification — nothing else in the booking flow needs to change.

**Driver documents: deferred, not built in Phase 2.** The Phase 0
storage architecture for private driver documents (`driver-documents`
bucket) still exists and is untouched, but Phase 2 does not build an
upload step — driver license/ID are checked physically at vehicle
handover instead. This was a deliberate scope decision (the Phase 2 brief
says "where required", not "required"), not an oversight — see the Phase
2 report for the reasoning.

## Phase 3 — admin dashboard & operations (implemented)

The admin dashboard (`src/features/admin/`, routed under `/admin/*` in
`src/App.tsx`) is the first UI built directly on top of the Phase 0
`admin_profiles` / `is_admin()` / "admins manage X" RLS foundation. It
adds almost no new backend surface — nearly every admin read/write goes
straight through the existing anon-key `supabase` client, governed
entirely by RLS policies that already existed. What Phase 3 actually adds
is documented in `supabase/migrations/20260827000000_phase3_admin_dashboard.sql`:
an `audit_logs` insert policy for admins, trigger-based audit logging on
vehicles/pricing/complaints (plus extending the existing booking-status
trigger), two new `complaints` columns (`internal_notes`, `resolution`),
a `pricing_client_price_le_list_price` check constraint, the
`vehicle_operational_status` view, and a handful of list/filter indexes.

**Admin auth is Supabase Auth + `admin_profiles`, not a second system.**
`AdminAuthContext` loads the Supabase session and then checks for a
matching `admin_profiles` row; `AdminRoute` is the single gate every
`/admin/*` route (except `/admin/login`) passes through. There is no
separate password store, no separate session, and no admin sign-up
flow — admin accounts are still provisioned by a one-time manual SQL
insert (`docs/SETUP.md`), unchanged from Phase 0.

**No duplicated business logic.** Three points in the spec explicitly
warned against a second implementation of something Phase 0–2 already
built, and each is resolved by reuse, not duplication:
- *Availability* — the admin Fleet/Availability pages read real booking
  rows and the new `vehicle_operational_status` view (a *current-moment*
  classification: available/reserved/rented/maintenance/unavailable).
  Neither one recomputes date-range availability; `available_vehicles()`
  from Phase 1 remains the only function that answers "is this vehicle
  bookable for dates X–Y".
- *Pricing* — the admin Pricing page reads/writes the same `pricing`
  table and reuses `TERM_LABELS` from `src/lib/pricing.ts`. There is no
  second price-calculation path; `quoteForDays()` remains the only place
  a rental total is computed.
- *Payments* — the admin Payments page is **read-only**. Phase 2's
  `confirm-payment` Edge Function and TEST-ONLY provider remain the only
  writers of payment state; the dashboard never mutates a payment row.

**Audit logging extends, rather than parallels, the existing trail.**
`booking_status_history` (Phase 0, detailed per-booking) is untouched;
the Phase 3 migration only adds a second, cross-entity `audit_logs`
write to the *same* trigger function, plus new triggers on
vehicles/pricing/complaints. One event, one or two writes from the same
trigger — never two independent logging mechanisms.

**Driver information stays booking-scoped.** The admin Booking Detail
page shows the driver the customer supplied for that booking (name,
license, expiry, and signed, time-limited links to their private
documents) — there is still no company-driver table, no assignment UI,
no availability/dispatch logic. This mirrors the Phase 0 business rule
that the company never provides drivers.

**Manual QA performed:** `npm run build`, `npm run lint`, and
`npm run test` all pass (see the Phase 3 completion report for exact
counts); the full RLS/security-boundary suite was re-run against a fresh
local Postgres 16 database seeded only from `stub_supabase_platform.sql`
and the four migrations in order (see `docs/DATABASE.md`); the admin
route tree, all nine feature pages, and the bilingual EN/AR + RTL layout
were reviewed against the running dev build. Live-network manual
click-through against the hosted Supabase project could not be performed
from this environment (no browser/session bound to the real project) —
see the Phase 3 report's "Manual QA performed" section for exactly what
was and wasn't exercised, and the "Exact manual steps required" section
for what the user should verify once deployed.

## Phase 4 — customer website frontend & homepage experience (implemented)

Frontend-only phase, by design: no migration, Edge Function, or schema
change accompanies it. The one new data access point,
`fetchFeaturedVehicles()` in `src/features/booking/api.ts`, is a plain
read against the same already-public `vehicles` / `vehicle_categories` /
`vehicle_images` / `pricing` tables `fetchVehicleById()` already reads —
same RLS, same shape, just without a date range or an id filter.

**Homepage rebuilt to the required section order** (`src/features/booking/HomePage.tsx`):
Header (`Layout`/`NavBar`, unchanged) → `HeroCarousel` → `BookingSearchSection`
→ `WhyChooseSection` (`#why-choose`) → `FeaturedVehicles` → `HowItWorksSection`
(`#how-it-works`) → Footer. The old icon-based `HeroSlider` is retired;
`HeroCarousel` (3 slides, autoplay 5s, pause on hover/focus, keyboard +
touch nav, RTL-aware controls, `prefers-reduced-motion` aware) is the new
main visual focus, using the same `hero.slides` copy as before — no
marketing copy was invented.

**No approved vehicle photography exists yet.** Per an explicit
constraint in the Phase 4 brief, hero imagery is three original,
hand-authored SVG illustrations in `src/assets/hero/` (`skyline-dusk`,
`airport-pickup`, `book-online` — an abstract skyline/car silhouette in
the brand's own palette, not a photo of any real place or vehicle),
each labelled "TEMPORARY placeholder" in its own `<title>` and in
`src/assets/hero/README.md`, which also documents the one-file swap
needed to drop in real photography later (`heroSlides.ts` only).

**The booking form itself is not duplicated.** `BookingSearchSection`
(the large section directly below the hero) and `StickySearchBar` (a
compact bar that appears below the header once `#booking-section` has
scrolled out of view, via `IntersectionObserver` — not a scroll
listener — and disappears when it's back in view) both render the same
`SearchWidget`, which gained a `layout?: 'grid' | 'row'` prop purely for
visual layout (`'row'` is a single horizontally-scrollable line so the
sticky bar stays compact on mobile instead of stacking four full-width
fields); all state, validation, and the `onSearch` contract are
unchanged.

**Featured Vehicles never fabricates data.** It calls
`fetchFeaturedVehicles()` and renders real rows through the existing
`VehicleCard` (now with `days` made optional — no dates yet means a
"From `<cheapest rate>`" headline instead of a dated total, still built
from `cheapestHeadlineRate()`/pricing data only) or an honest empty
state. Same rule for "Why Choose Bliss Rent" (`home.whyChoose`, replacing
the old `home.valueProps`) and "How It Works": both list only real,
already-true claims/steps — no invented awards, fleet-size, or
statistics.

**Header gained About/Services in-page anchors, no Contact/Support
link.** With no real support channel to point a Contact/Support link at
yet, the user chose in-page anchors only (About → Why Choose, Services →
How It Works) over inventing one. `Layout.tsx` added a small
`location.hash` → `scrollIntoView` effect so these anchors work from any
route, not just same-page clicks.

**Manual QA performed:** `npm run build`, `npm run lint`, and
`npm run test` all pass (140 tests, 20 new this phase covering homepage
rendering, the hero carousel + autoplay, language switch, RTL, the
booking form, sticky-bar show/hide, and both Featured Vehicles states).
The dev build was visually reviewed with Playwright/Chromium at Desktop
and Mobile widths, in English and Arabic, both at rest and scrolled past
the booking section — see the Phase 4 completion report. Live data was
not visible during that review because this environment's network
egress does not reach the hosted Supabase project; the empty/loading
states shown are exactly the code paths the automated tests exercise
with a mocked API, not a different, untested path.

## Phase 4.1 — real hero vehicle imagery + visual polish (implemented)

Visual/image-layer-only phase: `supabase/` was not touched (no schema,
migration, RLS, pricing, availability, payment, booking, admin, or auth
change), and `HeroCarousel.tsx`'s interactive logic (autoplay, pause on
hover/focus/keyboard, keyboard nav, touch swipe, RTL-aware arrows, dot
pagination, `prefers-reduced-motion`) is unchanged from Phase 4.

**The three placeholder SVGs are gone.** `src/assets/hero/` now holds five
real, photorealistic hero photos — `hero-economy.webp`, `hero-sedan.webp`,
`hero-suv.webp`, `hero-luxury.webp`, `hero-premium.webp` (1376×768, WebP,
20–55 KB each) — one per fleet category, generated with Google Gemini via
browser automation (no Gemini API/SDK access exists in this environment),
downloaded, and converted to WebP. Each is composed with the vehicle on
the right two-thirds of the frame and clean negative space on the left,
so the headline/CTA stay legible over the image; `hero-economy.webp` had
a visible third-party vehicle-brand badge on the grille removed via a
local clone-and-blend edit before export, so no third-party (or Bliss
Rent) logo appears in any file. See `src/assets/hero/README.md` for the
full per-file mapping and the process for swapping an image later.

**`heroSlides.ts` now exports `{ src, altKey }` pairs, not bare
strings**, so each slide's `<img>` gets real, translated, per-image alt
text (`hero.slideAlt.*` in en.ts/ar.ts) instead of the placeholder-era
`alt="" aria-hidden="true"` — `HeroCarousel.tsx` needed a one-line change
to read `.src`/`.altKey` off each entry, nothing else.

**`hero.slides` grew from 3 to 5 entries** (en.ts and ar.ts, mirrored) to
use every generated image — two new thematic lines ("Premium comfort,
every time" / "Drive Dubai in style") in the same voice as the existing
three, no invented claims. `HeroCarousel`'s slide count was already
designed to flex within the spec's 3–5 range, so this needed no logic
change, only more array entries.

**Manual QA performed:** `npm run test` (140/140, unchanged pass count —
no new test cases were needed since existing tests read slide count from
i18n rather than hardcoding 3), `npm run build`, and `npm run lint` all
pass. The dev build was visually reviewed with Playwright/Chromium at
Desktop (1440×900) and Mobile (390×844), in English and Arabic, cycling
through all five slides in each configuration — see the Phase 4.1
completion report.

## Multi-emirate locations (Dubai + Abu Dhabi)

`locations` gained a `city` TEXT column (migration
`20260909000000_abu_dhabi_locations_multi_emirate.sql`) alongside the
existing `location_type` enum (`'airport' | 'city'`). Every location row
now carries both: `type` says whether it's an airport counter or a
city drop-off point, and `city` says which emirate it's in (`'Dubai'` or
`'Abu Dhabi'` today — the column is free-text so a future emirate is a
data row, not a schema change).

`fetchLocations()` (`src/features/booking/api.ts`) returns the full,
unfiltered list ordered by `city`, then `type`, then `name`; callers that
need a single city's points filter the result by `.city` themselves.
`SearchWidget` does exactly this: a "Pickup City" selector (`pickupCity`
state, Dubai listed first, other cities alphabetical) drives a derived
`cityLocations` list that the pickup/drop-off `<select>` options map
over, so switching city clears any location picked in the old one rather
than leaving a stale, invisible selection. `LocationsPage` groups the
same data by city first, then by type within each city, with headings
built as `"{city} — {airport/city heading}"` — a dash-joined format
chosen specifically so it reads correctly in both English and Arabic
without a separate translated heading per city.

Coverage is still explicitly bounded: the FAQ, footer, homepage copy,
About page, and booking terms all say Dubai **and** Abu Dhabi, not
UAE-wide — adding a third emirate later means a new `locations` city
value, no other schema change, but the copy above should be revisited
each time the coverage set grows.
