-- Phase 9G — pickup/return reminder emails: the scheduling infrastructure.
--
-- Business decision (phase-9-business-decisions-confirmed-2026-08-31.md,
-- item 3): "Pickup/return reminder emails — In scope for Phase 9. Requires
-- new scheduled-function infrastructure (Supabase cron-triggered Edge
-- Function or pg_cron), reading `bookings` only, no writes to it." This
-- migration is that infrastructure: nothing here reads or writes any
-- table other than what pg_cron/pg_net need for their own bookkeeping.
-- The actual query against `bookings` lives entirely in the Edge
-- Function (supabase/functions/send-rental-reminders/), which this
-- schedule does nothing but invoke once a day over HTTP.
--
-- REMINDER WINDOW ASSUMPTION: exactly 1 day before a booking's
-- start_date (pickup) or end_date (return) — see
-- supabase/functions/_shared/email/rentalReminders.ts's
-- REMINDER_WINDOW_DAYS constant. No timing decision for this exists
-- anywhere in the Phase 9 planning docs beyond "in scope"; this is a
-- reasonable default, not a business decision made on your behalf, and
-- is a one-line change if you want a different window.
--
-- SCHEDULE TIME: 06:00 UTC daily, chosen only as a placeholder "morning"
-- slot — adjust the cron expression below to Bliss Rent's actual
-- operating timezone/hours before relying on it in production.
--
-- SECURITY — no secret is embedded in this file. Supabase's documented
-- pattern for a pg_cron job that calls an Edge Function is to store the
-- function's URL and its shared secret in Supabase Vault
-- (https://supabase.com/docs/guides/database/extensions/pg_cron), read
-- back at schedule-run time via `vault.decrypted_secrets` — never as a
-- literal in a migration. This migration assumes two Vault secrets
-- already exist:
--   'send_rental_reminders_url'  — the deployed function's full URL,
--                                  e.g. https://<project-ref>.supabase.co/functions/v1/send-rental-reminders
--   'cron_secret'                — a fresh random value, ALSO set as this
--                                  function's CRON_SECRET environment
--                                  variable (Project Settings > Edge
--                                  Functions > send-rental-reminders),
--                                  which is what the Edge Function itself
--                                  checks (see send-rental-reminders/logic.ts).
--
-- Neither secret can be created from this environment (this migration
-- has not been applied, and no deployment has happened — see the Phase 9
-- brand-update completion report's "do not deploy" boundary). Whoever
-- deploys this function must first run, once, with the real values:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-rental-reminders', 'send_rental_reminders_url');
--   select vault.create_secret('<a-fresh-random-value>', 'cron_secret');
-- and set the same random value as the function's CRON_SECRET env var,
-- before this schedule can successfully call anything. Until then, this
-- migration applies safely (it registers a schedule, nothing more) but
-- every scheduled run will fail closed with a clear error in the cron
-- job's own run history — never silently, and never by sending an email
-- to the wrong place.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-rental-reminders-daily',
  '0 6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'send_rental_reminders_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

comment on extension pg_cron is 'Phase 9G: schedules the daily send-rental-reminders Edge Function call. No other job uses this extension today.';
