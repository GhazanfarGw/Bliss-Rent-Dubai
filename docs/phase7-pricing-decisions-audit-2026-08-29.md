# Phase 7 — Extension Pricing & Late-Penalty: Audit + Completion Report (2026-08-29)

## Scope

Two owner messages this session finalized the two pricing decisions Phase 7 had deliberately left open since launch:

1. **Normal extension pricing** — bill at the vehicle's *current* daily rate (`current_vehicle_daily_rate × extension_days`), never the original booking's historical rate, with no added markup.
2. **Late-extension penalty** — an *admin-configurable* percentage of the base extension amount (initial value 10%), applied only when the extension is processed after the original return date. Not hard-coded — the owner must be able to change it from Settings later with zero code deployment, and a change must never rewrite an already-processed extension's stored numbers.

Per instruction: **implementation + tests only, run locally, do not deploy to production.**

## 1. Audit of the existing implementation

Before changing anything, I read the full Phase 7 stack (`extensionPricing.ts`, `extensionPenalty.ts`, both Phase 7 migrations, `RentalExtensionsSection.tsx`, `adminExtensionsApi.ts`, `AdminSettingsPage.tsx`) end to end. Findings:

- **Confirmed correct already:** the late-penalty *architecture* was never hard-coded. `computeExtensionPenalty()` has always read `percentageRate`/`perDayAmount`/`fixedFeeAmount` from `extension_penalty_settings` (an owner-editable table, RLS-gated to `is_super_admin()`), not from a literal in code. Changing the settings row already changes every future extension's penalty with no deployment. This needed configuring with a real value, not rebuilding.
- **Confirmed correct already:** no extension anywhere in the codebase silently added a 10% (or any) markup to a *normal* (non-late) extension. Grepped for stray `1.1`/`10%`/markup multipliers — none found outside the one legitimate late-percentage path.
- **Confirmed correct already, client-side:** the entire Extension Pricing/Penalty settings UI in `AdminSettingsPage.tsx` is already gated behind `isSuperAdmin` (`adminProfile?.role === 'super_admin'`) — a staff account never even sees these controls. The **real, authoritative** gate is the database RLS policy (`is_super_admin()` on `UPDATE`), which was already correct and unchanged.
- **Genuine bug found and fixed:** the `'current_rate'` pricing policy delegated to `quoteForDays()` — the *same tiered daily/weekly/monthly engine* used for pricing original bookings. For any extension of 7+ days, this would silently apply the vehicle's **weekly** rate instead of `daily_rate × days`, which is a different (and never-approved) formula from the one just confirmed. Example of the bug this fixes: a vehicle priced at AED 100/day and AED 600/week, extended 10 days, would have billed AED 857 (600/7 × 10, rounded) instead of the correct AED 1,000 (100 × 10).
- **Genuine gap found and fixed:** an already-processed extension's `penalty_amount` (the AED figure) was correctly frozen and never recomputed — but the *raw rate* that produced it (e.g. "10%") was never stored anywhere, only the policy *name* (`percentage`) and the resulting money amount. A person reviewing extension history after the owner later changes the percentage would see an AED figure with no way to tell what rate produced it.
- **Genuine gap found and fixed:** neither `extension_pricing_settings` nor `extension_penalty_settings` had any audit trail. `updateExtensionPricingSettings()`/`updateExtensionPenaltySettings()` wrote directly to the table with a client-supplied, self-reported `updated_by`/`updated_at` — nothing recorded *what* changed, and the actor attribution wasn't even server-verified.

## 2. What changed

### Pricing calculation (`src/lib/extensionPricing.ts`)
`'current_rate'` now reads the vehicle's plain `daily` pricing row directly and computes `daily_rate × extension_days` — never the tiered weekly/monthly engine. Throws a clear `ExtensionPricingError` if the vehicle has no daily price configured (matching the project's existing "refuse to guess" convention), even if it has weekly/monthly pricing.

### Penalty calculation (`src/lib/extensionPenalty.ts`)
`ExtensionPenaltyResult` now also returns `rateUsed` — the raw configured value applied (the percentage/per-day/fixed-fee number itself), separate from the computed `amount`. The formula itself was already correct and was not hard-coded; this only adds the missing "what rate produced this" figure for storage/display.

### Database — new migrations (local only, not deployed)
- **`20260905000000_phase7_pricing_decisions_confirmed.sql`** — seeds the two singleton settings rows with the confirmed values (`extension_pricing_settings.policy = 'current_rate'`; `extension_penalty_settings.policy = 'percentage'`, `percentage_rate = 10`), only where still `NULL` (never overwrites a value the owner may already have set).
- **`20260906000000_phase7_penalty_admin_control_and_audit.sql`**:
  - Adds `booking_extensions.penalty_rate_used` (numeric, nullable) — the raw rate frozen onto each processed extension alongside the existing `penalty_amount`/`penalty_policy_used`, so a later Settings change can never alter what an already-approved extension is shown to have used.
  - Replaces `request_booking_extension()` to accept and store the new `p_penalty_rate_used` parameter (trailing, defaulted, backward compatible).
  - Adds `audit_extension_pricing_settings_change()` / `audit_extension_penalty_settings_change()` — plain `AFTER UPDATE` triggers on both settings tables, following the *exact* existing pattern (`audit_vehicle_change`/`audit_pricing_change`/`audit_complaint_status_change` in `20260827000000_phase3_admin_dashboard.sql`). They insert into the existing `audit_logs` table (no new/duplicate audit system), recording the previous and new value of every column, `auth.uid()` as actor, and `audit_logs.created_at` as the timestamp — a no-op if a save didn't actually change any value.

### Admin UI (`RentalExtensionsSection.tsx`)
- The late-penalty preview and the extension-review form now pass `penaltyRateUsed` through to `requestBookingExtension`/`processExtensionRequest`, freezing it onto the record.
- Added a **Total** line to the review form (base + penalty when late) and a **Total** column to the extension history table, so the actual amount to collect is never left for the admin to add up by hand.
- The penalty display (form preview and history table) now shows the rate alongside the amount for a percentage policy, e.g. "AED 50 (10%)".

### Types (`src/types/database.ts`, `adminExtensionsApi.ts`)
`booking_extensions.penalty_rate_used` and `request_booking_extension`'s new parameter added to the generated-style types; `RequestExtensionInput` gained `penaltyRateUsed`.

### i18n
Added `admin.extensions.form.totalLabel` / `admin.extensions.table.total` in both `en.ts` and `ar.ts`.

## 3. Verified calculations against the owner's exact examples

| Scenario | Formula | Expected | Test |
|---|---|---|---|
| Normal extension | AED 100/day × 5 days | AED 500 | `extensionPricing.test.ts` — "matches the owner-confirmed example exactly" |
| Late extension | AED 500 base × 10% | AED 50 penalty, AED 550 total | `extensionPenalty.test.ts` — "matches the owner-confirmed late-extension example exactly" |
| Owner changes 10% → 15% | AED 500 × 15% | AED 75 penalty, AED 575 total | `extensionPenalty.test.ts` — "the 10% initial value is NOT hard-coded" |
| Regression: 10-day extension | must use daily rate, not the weekly tier | AED 1,000, not AED ~857 | `extensionPricing.test.ts` — "regression: always multiplies the plain DAILY rate..." |

## 4. Test coverage against the owner's checklist

1. Default initial penalty = 10% → seeded via migration; not independently unit-testable without a live DB (no SQL test harness in this project) — verified by direct `SELECT` once deployed, same as every other Phase 7 migration.
2. Normal extension has no late penalty → `computeExtensionPenalty` returns `null` when `isLate: false`, existing test, still passing.
3. Late extension uses configured penalty → existing + new tests passing.
4. Admin changes penalty 10% → 15% / 5. New extension uses 15% → new test, `extensionPenalty.test.ts`.
6. Existing processed extension remains at its original 10% → structural guarantee: `penalty_amount` and (new) `penalty_rate_used` are computed once and stored on the row; nothing in the read/display path recomputes either from live settings.
7. Unauthorized staff cannot change the penalty setting → DB RLS (`is_super_admin()`, pre-existing, unchanged) is the real gate; added a client-side test in `AdminSettingsPage.test.tsx` confirming a `staff`-role admin never even sees the Extension Pricing/Penalty sections.
8. Penalty calculation correct → full `extensionPenalty.test.ts` suite.
9/10. Invoice/payment total contains the correct penalty amount → this project has no separate "invoice" document; the equivalent is `booking_extensions.amount` + `penalty_amount`, both stored and both now also surfaced as an explicit **Total** in the admin form and history table (previously the admin would have had to add them manually).
11. Full Phase 0–6 regression → this project's test suite is not phase-partitioned; the full run below covers it.

## 5. Verification results

- `tsc --noEmit`: clean.
- `vitest run`: **257/257 tests passing** across 42 files (249 → 257: 8 new tests, 0 broken).
- `vite build`: succeeds.
- `oxlint`: no new warnings or errors on any touched file (only pre-existing, unrelated warnings elsewhere).

## 6. Not done (per explicit instruction)

- **Nothing deployed to production.** Both new migrations (`20260905000000`, `20260906000000`) exist locally only.
- Phase 8 not started.

## 7. Next step, when the owner is ready

Apply `20260905000000_phase7_pricing_decisions_confirmed.sql` and `20260906000000_phase7_penalty_admin_control_and_audit.sql` to production (in that order), then verify:
```sql
select policy from extension_pricing_settings where id = 1; -- expect 'current_rate'
select policy, percentage_rate from extension_penalty_settings where id = 1; -- expect 'percentage', 10
```
Awaiting explicit go-ahead before doing so.
