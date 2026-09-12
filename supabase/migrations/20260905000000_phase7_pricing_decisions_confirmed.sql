-- =============================================================================
-- Phase 7 — Extension pricing & late-penalty decisions CONFIRMED (2026-08-29)
--
-- NOT YET APPLIED TO PRODUCTION. Written and tested locally only, per this
-- phase's explicit instruction: build and test locally first, then stop.
--
-- This migration resolves the two owner decisions that
-- 20260902000000_phase7_rental_extensions.sql and
-- 20260903000000_phase7_booking_reassignment.sql deliberately left NULL
-- ("PRICING POLICY — DELIBERATELY LEFT UNSET" / "PENALTY POLICY —
-- DELIBERATELY LEFT UNSET"). Nothing about the schema, the two settings
-- tables, or the TypeScript calculation layer's "one authoritative
-- calculation path" design changes here — this migration only SEEDS the
-- now-confirmed values into the existing singleton settings rows. The
-- owner can still change either value later from Settings (super_admin
-- only), same as before; these are just no longer NULL/blocking.
--
-- 1. EXTENSION PRICING — confirmed: bill at the vehicle's CURRENT daily
--    rate, never the original booking's historical rate, and with no
--    additional markup on a normal (non-late) extension.
--      extension_base_amount = current_vehicle_daily_rate × extension_days
--      Example: AED 100/day × 5 days = AED 500.
--    -> extension_pricing_settings.policy = 'current_rate'.
--    IMPORTANT companion fix (see src/lib/extensionPricing.ts): the
--    'current_rate' calculation previously delegated to quoteForDays(),
--    the SAME tiered daily/weekly/monthly engine used for original
--    bookings — which would apply a cheaper WEEKLY rate to a 7+ day
--    extension instead of daily-rate × days. That is a different (and
--    never-approved) business rule from the one actually confirmed above,
--    so the TypeScript layer was corrected to always use the vehicle's
--    plain 'daily' pricing row × extension_days, regardless of extension
--    length. No SQL change was needed for this fix — the pricing amount
--    is computed entirely in TypeScript, matching this project's existing
--    "SQL is a data-integrity backstop, not a second pricing
--    implementation" convention (see request_booking_extension's comment).
--
-- 2. LATE-EXTENSION PENALTY — confirmed: a flat 10% surcharge on the base
--    extension amount, ONLY when the extension is requested/processed
--    after the original return date. A normal (on-time) extension never
--    receives this surcharge.
--      late_penalty = extension_base_amount × 10%
--      total_extension_amount = extension_base_amount + late_penalty
--      Example: AED 500 base + AED 50 (10%) = AED 550.
--    -> extension_penalty_settings.policy = 'percentage',
--       percentage_rate = 10.
--    This is exactly the 'percentage' policy computeExtensionPenalty()
--    already implemented (amount = extensionAmount × percentageRate / 100)
--    — no calculation bug here, only the missing configured value.
-- =============================================================================

update extension_pricing_settings
set policy = 'current_rate',
    updated_at = now()
where id = 1
  and policy is null; -- don't clobber a value the owner may have already set through Settings since Phase 7 shipped

update extension_penalty_settings
set policy = 'percentage',
    percentage_rate = 10,
    currency = coalesce(currency, 'AED'),
    updated_at = now()
where id = 1
  and policy is null; -- don't clobber a value the owner may have already set through Settings since Phase 7 shipped

comment on table extension_pricing_settings is
  'Singleton (id always 1). CONFIRMED 2026-08-29: policy = current_rate — extensions bill at the vehicle''s CURRENT daily rate (current_vehicle_daily_rate × extension_days), never the original booking''s historical rate, with no markup on a normal extension. Still owner-configurable from Settings (super_admin only) if this ever needs to change; the extension request flow refuses to proceed only if policy is ever cleared back to NULL. See supabase/migrations/20260905000000_phase7_pricing_decisions_confirmed.sql.';

comment on table extension_penalty_settings is
  'Singleton (id always 1). CONFIRMED 2026-08-29: policy = percentage, percentage_rate = 10 — a late extension (requested after the original return date) carries a flat 10% surcharge on the base extension amount; an on-time extension never does. Still owner-configurable from Settings (super_admin only) if this ever needs to change. See supabase/migrations/20260905000000_phase7_pricing_decisions_confirmed.sql.';
