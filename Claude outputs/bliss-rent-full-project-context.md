# Bliss Rent — Dubai Airport Rental: Full Project Context
**Compiled 2026-09-19, for handoff to another AI assistant (ChatGPT) after memory loss. Paste this whole document in to restore full project context.**

---

## 1. What this project is

**Bliss Rent** — a car rental platform serving Dubai Airport customers. Production domain: **bliss.rent**. Production repo: `GhazanfarGw/Bliss-Rent-Dubai` (git-linked to the Vercel project that serves bliss.rent). Two earlier repos (`Bliss-Rent---UAE`, `dubai-airport-rental-preview`) are obsolete/deleted — if any old documentation mentions them, ignore it.

**Stack:** React + TypeScript + Vite frontend, Supabase (Postgres + Auth + Edge Functions) backend, Stripe for card payments, Resend for transactional email, Vercel for hosting.

**Working relationship:** Ghazanfar (the developer) handles frontend UI layout/styling/local adjustments himself. The AI assistant acts as the full-stack partner — backend logic, database, API integrations, migrations, Edge Functions. Standing rule throughout this project: **no deployment/migration/push without explicit approval** — every phase below was implemented and verified locally first, then deployed only after sign-off. Ambiguous business rules get surfaced as a question, never guessed.

---

## 2. Everything completed, in build order

**Phases 0–3 (foundation) — fixed Aug 26, 2026.** Admin login, Fleet, Pricing, Search, and Checkout/Payment had all been *written* in earlier phases but several migrations had never actually been *run* against the live database (a recurring root cause worth remembering: "works in code, 500s in production" in this project usually means a migration file exists but was never applied — check `pg_proc`/`information_schema` before assuming an app bug). All fixed; also added: browse-without-dates search mode, "Reserved" tagging for booked vehicles in search results (instead of hiding them), admin workload badges (tab counts + sidebar pill), and a full Revenue & Earnings analytics dashboard (hand-built SVG charts, no chart library).

**Checkout/payment flow recovery — Sep 2.** Root cause of a real production bug (customers hitting a false "vehicle just booked" error when navigating Payment → Back → Summary) was that the page recreated the booking on every render with no memory of one already created. Fixed with a session-storage "active booking pointer" (resume instead of recreate), a header "pending booking" reminder icon, a Payment-Failed retry panel, and a new Super-Admin-only `admin_confirm_booking_payment()` RPC for manually marking a stranded booking paid. `bookings_no_overlap` (the DB constraint preventing double-booking) was never weakened.

**Phase 11 — Premium booking/admin UI overhaul — Sep 2.** Closed a real security gap: booking status used to be changeable via a completely unrestricted admin dropdown with no payment-status awareness (how a booking could end up "confirmed" but unpaid). Replaced with controlled, Super-Admin-only RPCs (`admin_cancel_booking`, `admin_start_rental`, `admin_mark_returned`, plus the existing `admin_confirm_booking_payment`) and narrowed RLS so direct `UPDATE` on bookings is no longer possible for anyone. Also: full lucide-react icon system replacing Unicode/hand-rolled icons, a sitewide sweep onto semantic color tokens, the homepage "Booking Navigator" (Search Cars / Manage Booking / Booking Status / Contact tabs), and full 9-breakpoint + Arabic/RTL verification.

**Checkout v2 — Sep 5.** Rebuilt Steps 4–7 (Customer Details, Driver Details, Review, Payment) with a modern mobile-first flow and **real Stripe integration** (test-mode keys) via Stripe's Payment Element. Added first/last name split fields and driver phone (small additive migration). No date-of-birth field anymore (18+ check removed as a disclosed consequence).

**Extension price preview — Sep 5.** Customers requesting a rental extension now see a live "you paid X, this adds Y [+ late fee], new total Z" estimate before submitting, and the approval email shows the same breakdown. New public read-only RPC exposes just enough pricing config for the frontend to compute this without a network call per keystroke.

**Admin testing-data reset — Sep 5.** Wiped all test bookings/customers/payments/etc. from production; **kept the real fleet/catalog** (29 vehicles, pricing, locations) and admin accounts.

**Phase 13 — Stripe production-readiness — Sep 6.** Full audit of the Stripe integration: duplicate-payment protection, double-submit guards, resume-vs-recreate, decline/retry handling, server-authoritative pricing, RLS, secrets hygiene — all verified sound, zero code changes needed. One real gap found and closed: **no Stripe webhook existed**, so a payment that succeeded at Stripe but never got confirmed back (browser closed at the wrong instant) had no automatic recovery. Built and deployed a webhook Edge Function (signature verification, idempotent event log, safe against every ordering of frontend-vs-webhook confirmation). Later that day, live-tested end-to-end with a real Stripe test-mode payment (card `4242 4242 4242 4242`) — confirmed the webhook fires, verifies, and reconciles correctly, and Phase 9's email pipeline still fires correctly for both `booking_received` and `booking_confirmed`.

**Phase 14 — Reserved-copy inventory model — Sep 7–8.** Business problem: a `vehicles` row was both the public listing AND the one physical bookable car, so a booking made the whole listing unavailable for those dates, and the real plate was visible to the customer immediately. New model: **the master listing stays bookable indefinitely; every paid booking clones a "Reserved copy" row** (capacity 1, real inventory only once confirmed); the customer never sees a real plate until an admin later confirms it via a new **"Confirm Vehicle"** action — new plate → inventory +1, existing plate → booking is repointed onto the existing vehicle and the copy retired. Customer notification (email + WhatsApp) fires only at that confirmation step, never before. **Database migration + Edge Function (`deliver-plate-confirmation-notifications`) are deployed and live in production.** The frontend piece (the "Confirm Vehicle" admin UI button, updated types) was built and verified but **never reached production** — it was blocked at the time by the local repo pointing at the wrong GitHub remote and missing push credentials (see §5, this may now be resolved since the repo was corrected in the SEO work below — worth re-attempting).

**Tasks 1–4 — Sep 11.** (1) Public fleet listings now require a price + image before showing, and identical Make+Model+Year listings collapse into one card with a quantity badge; reserved/duplicate copies excluded from all public views. (2) WhatsApp contact button added to every vehicle card (fixed a pre-existing wrong phone number in the nav bar too). (3) Contact Us complaints can now get an admin reply by email — **migration + Edge Function deployed to production same day.** (4) Stripe re-audited, confirmed clean of any customer-visible test-mode leakage, no changes needed. **Bonus fix, same day:** found and fixed a real production bug — Contact Us submissions had been silently failing because a required database function had never been applied to the live DB (same "migration never ran" pattern as Aug 26).

**Find My Car / Manage Booking split — Sep 11 (local repo only).** Production already had these as two separate flows (status-check-only vs. full lookup/extend/pay) from an earlier session; brought the developer's local machine's older, drifted copy of the codebase in line with it.

**Temporary WhatsApp-first checkout — Sep 11 (local only, deliberate and reversible).** Checkout's payment step was swapped to show the booking reference + amount due + a "Continue on WhatsApp" button, so customers can pay manually with staff instead of by card, while the real Stripe integration underneath is left completely untouched (confirmed via git diff — zero changes to `PaymentPage.tsx`, the Edge Functions, or the webhook). Revert is two lines in `App.tsx`, both flagged with a `TEMPORARY (2026-09-11)` comment.

**SEO pass — Sep 12–13 (on local `master` branch).** New `scripts/generate-sitemap.mjs` (runs on every build) generates `sitemap.xml` live from Supabase — only real, publicly-bookable vehicles, matching the same filter the live site itself uses. Every route got its own canonical tag and meta description (previously the whole SPA shared one static description). A first pass used the wrong domain (`bliss-rent-uae.vercel.app`, from stale docs); corrected in a follow-up commit to the real production domain **bliss.rent**, confirmed via the Vercel dashboard, and the git remote was corrected to `GhazanfarGw/Bliss-Rent-Dubai` in the same pass.

**Full front-end redesign — Sep 13 (pushed to GitHub `main`).** A site-wide "sharp-editorial" redesign across every phase (design tokens, nav/footer, homepage, vehicle browsing/detail/search, content pages, checkout). About page rebuilt end-to-end with a real business-model diagram. New header Cities dropdown, real UAE/UK flag icons on the language switcher, Manage Booking redesigned as a flat airline-style form, a site-wide Feedback widget, a header Site Search. Also fixed a sitewide bug where every `position: sticky` element (filter sidebar, mobile filter bar, search bar, homepage ticker) had silently stopped sticking — a global `overflow-x: hidden` on `html, body` was forcing `overflow-y` to compute as `auto`, making `body` the nearest scroll container; fixed by switching to `overflow-x: clip`.

**Customer support chat — Sep 14 (pushed to GitHub `main`).** FAQ bot + live two-way chat widget, with an admin dashboard for staff to answer conversations in real time. Largest single commit of that week. Also: Hero restored to full-height on mobile, homepage ticker bar removed.

---

## 3. Current status: Stripe / Payments

- The Stripe integration itself (PaymentIntent creation/reuse, Payment Element checkout, webhook reconciliation, idempotent confirmation, server-authoritative pricing) is **fully built, audited, and verified working** — nothing about the payment logic is unfinished.
- **Deliberately still in Stripe Test Mode**, using the developer's own personal Stripe account for integration purposes. The plan (confirmed, not yet acted on) is to swap in the **company's own live Stripe keys** once that account exists, and switch to Live Mode only then, with explicit go-ahead — not automatically.
- Going live needs only: swap `VITE_STRIPE_PUBLISHABLE_KEY` and the `STRIPE_SECRET_KEY` Edge Function secret to live keys, and register a **live-mode** webhook endpoint (a separate one from the test-mode one already configured) with its own `STRIPE_WEBHOOK_SECRET`. No code changes required.
- **Temporary override currently sitting locally, not deployed:** the checkout payment step is swapped to send customers to WhatsApp to pay with staff manually, instead of the live Stripe form. This exists only on the developer's machine, not in production, and is a clean two-line revert whenever it should go live or be dropped (see §2, "Temporary WhatsApp-first checkout").
- One documented, still-open gap (not urgent): no automatic expiry for an abandoned `pending_payment` booking — it holds its date range indefinitely until an admin manually cancels it. Flagged, not decided.
- One piece of cosmetic housekeeping never done: an old, inert, misconfigured Stripe webhook destination is still listed in the Stripe dashboard (harmless — it can never receive a matching event — but could be deleted for tidiness).

## 4. Current status: WhatsApp

- **No WhatsApp automation vendor has been chosen or integrated anywhere in this project** (not Twilio, not Meta's Cloud API, nothing). This has been flagged as a genuine business/vendor decision, not a coding task, every time it's come up.
- All existing WhatsApp presence today is **manual click-to-chat only** — a single centralized `wa.me` link (`contactLinks.ts`) used in the nav bar, on every vehicle card, and in the temporary checkout flow. Staff answer these by hand.
- The Phase 14 plate-confirmation notification system is *already wired* to attempt automatic WhatsApp delivery the moment a vendor is chosen — it checks a `WHATSAPP_PROVIDER` setting, and today (unset) it safely and idempotently resolves to `not_configured` with zero errors, fully logged. The **only file that would need to change** to turn this on is `dispatchPlateConfirmedWhatsapp.ts` — nothing else.
- **Net status: WhatsApp automation is not built and is waiting on a vendor decision.** Everything else in the project has been built to not depend on it.

## 5. What's built and tested but NOT yet in production

- **Phase 14 "Confirm Vehicle" admin frontend** (button, API wrapper, updated types) — the database RPC and Edge Function it calls are live, but this UI piece never got pushed. It was blocked at the time by the local repo's git remote pointing at the wrong/dead GitHub repo and missing push credentials. **Worth re-checking now** — the repo remote was corrected during the SEO work (§2) to the real `GhazanfarGw/Bliss-Rent-Dubai`, so this earlier blocker may no longer apply.
- **SEO/sitemap work** (sitemap generator, per-route metadata, domain correction) — committed locally on the `master` branch, not yet pushed/merged.
- **WhatsApp contact button + fleet publishing/grouping rules** (Tasks 1–2 from Sep 11) — committed locally, not yet pushed.
- **Find My Car / Manage Booking split** — committed locally (this was to bring the local dev copy in line with what's already live in production; low urgency).
- **Temporary WhatsApp-first checkout** — deliberately not deployed; awaiting a decision on when/whether to use it.

As of the last check (Sep 14), the local machine had two diverged git branches — `main` (matches what's pushed to GitHub, includes the full redesign and support chat) and `master` (a separate line carrying the SEO work, the WhatsApp checkout, and the earlier Phase-14-era commits) — that have not been reconciled into one. There was also, at that time, no outbound network path from that machine to GitHub at all (proxy-level block) — status of that should be re-checked before assuming a push will work.

## 6. Known issues / technical debt (not urgent, just tracked)

- `main` vs `master` branch reconciliation (above).
- A handful of pre-existing, unrelated frontend test failures (`HomePage.test.tsx`, `BookingSearchSection.test.tsx`, `BookingSummaryPage.test.tsx`) tracked across multiple phases as leftover debt from earlier UI rewrites — never touched or worsened by any of the work above.
- One specific data inconsistency, never resolved: booking `BLS-E16F5DC3` is `confirmed` but its payment is still `pending` (caused by a manual admin status change made outside any of the tooling above, before it existed). Flagged twice, left as-is pending the owner's choice of what to do with it.
- Supabase's security advisor flags a low-severity, project-wide pattern (Postgres's default `EXECUTE` grant to `anon`/`authenticated` isn't fully undone by a function's own `revoke ... from public`) on ~22 functions including `submit_complaint_public` — real exposure assessed as low (guest-input-only, no elevated read-back) and consistent with an already-accepted pattern elsewhere in the schema; no action taken.

## 7. Decisions needed to move forward

1. **Push the pending local work to production** — SEO/sitemap, the WhatsApp contact button + fleet grouping rules, and the Phase 14 "Confirm Vehicle" admin UI are all built and verified; they just need to be merged/pushed (re-check GitHub connectivity from the dev machine first).
2. **When to switch checkout back from "pay via WhatsApp" to live card payments** — the temporary flow is active only locally right now; going live with real Stripe payments is a one-line revert once ready.
3. **Choose a WhatsApp Business API vendor** (Twilio, Meta Cloud API, or other) so automated plate-confirmation messages (and any future automation) can actually be built — nothing further can happen here without this decision.
4. **Stripe go-live timing** — once the company's own Stripe account exists, say when to swap in live keys.
5. Optional/low-priority: reconcile the `main`/`master` branch split; delete the old inert Stripe webhook destination; decide on an automatic-expiry policy for abandoned pending-payment bookings; decide what to do with the `BLS-E16F5DC3` data inconsistency.
