-- =============================================================================
-- Phase 9C — email_log table
--
-- Purely additive. Creates exactly one new table and its RLS policy.
-- Nothing else in the schema is touched.
--
-- REUSES, UNCHANGED:
--   - `bookings` — email_log.booking_id is a plain nullable FK to it,
--     on delete set null (an email record about a since-deleted test
--     booking should never block that delete, and losing the booking
--     link doesn't lose the log row). No column, trigger, or constraint
--     on `bookings` itself is touched.
--   - `booking_notifications` — left completely alone, per the Phase 9A
--     decision to build a new table rather than widen it. It keeps
--     recording the same 4 extension/reassignment event types it always
--     has; email_log is a separate, general-purpose log for every kind
--     of outbound email this phase adds on top of that.
--   - `is_admin()` (Phase 0) — reused as-is for the read policy, exactly
--     like `audit_logs` and `booking_notifications` already do. Not
--     redefined here.
--   - pricing, payments, extensions, vehicles, and every RLS policy
--     governing them — none referenced, none modified.
--
-- WHO WRITES HERE: nobody, under RLS. Deliberately no insert/update/delete
-- policy at all (same shape as `booking_notifications`'s admin-read-only
-- policy) — the `send-email` Edge Function (built in a later sub-phase)
-- writes with the service-role key, which bypasses RLS entirely, exactly
-- like `create-booking`/`confirm-payment` already do for their own
-- tables. No email is sent by this migration; it only creates a place to
-- eventually record that one was sent.
--
-- IDEMPOTENCY: a single `idempotency_key` column with a unique index,
-- rather than a fixed (booking_id, event_type) unique constraint, so one
-- mechanism covers both shapes the Phase 9 report calls for (Section 16):
--   - a once-per-booking event (e.g. "booking confirmed") keys on
--     `booking:<booking_id>:<event_type>`
--   - an event that can legitimately repeat (e.g. a generic status
--     change) keys on `booking:<booking_id>:<event_type>:<triggering_row_id>`,
--     folding in the id of the row that caused this specific send
-- The key's exact shape is decided by the caller (9D onward) at
-- send-time; this migration only enforces that whatever key is chosen is
-- never reused, so a retried or duplicated trigger can never produce two
-- emails for the same real-world event.
-- =============================================================================

create table email_log (
  id                    uuid primary key default gen_random_uuid(),

  -- Uniquely identifies the real-world event this email is for — see the
  -- IDEMPOTENCY note above. Never reused; a second send attempt for the
  -- same event must reuse the same key and hit the unique index instead
  -- of inserting a duplicate row.
  idempotency_key       text not null,

  -- Nullable on purpose: most events today are booking-related, but this
  -- table is meant to outlive any one event type (e.g. a future
  -- non-booking admin notice), so the FK is optional, not required.
  booking_id            uuid references bookings (id) on delete set null,

  -- e.g. 'booking_confirmed', 'payment_received', 'extension_approved',
  -- 'pickup_reminder', 'complaint_received' — free-text, not an enum,
  -- same reasoning as locations.city/country: the event catalog grows
  -- as 9D-9J add senders, and a schema change per new event type would
  -- defeat the point of this table.
  event_type            text not null,

  recipient_type        text not null check (recipient_type in ('customer', 'admin')),
  recipient_email       text not null,
  language              text not null check (language in ('en', 'ar')),

  -- Identifies which base template + which concrete rendering was used
  -- (e.g. 'customer_booking_confirmation') — not the rendered HTML
  -- itself; the HTML is regenerated on demand from logic, never stored.
  template              text not null,
  subject               text not null,

  status                text not null default 'queued'
                          check (status in ('queued', 'sent', 'delivered', 'bounced', 'failed')),
  provider_message_id   text,
  failure_reason        text,
  retry_count           integer not null default 0,

  created_at            timestamptz not null default now(),
  sent_at               timestamptz,
  updated_at            timestamptz not null default now()
);

create unique index email_log_idempotency_key_idx on email_log (idempotency_key);
create index email_log_booking_id_idx on email_log (booking_id);
create index email_log_status_idx on email_log (status);
create index email_log_created_at_idx on email_log (created_at desc);

comment on table email_log is
  'Delivery status/log for every email the Phase 9 email system sends. Additive-only table, created in 9C; nothing writes to it yet -- the send-email Edge Function that will (9D onward) uses the service-role key, which bypasses RLS the same way every other privileged write in this codebase already does. See supabase/functions/_shared/email/README.md for the templates this log will eventually track sends for.';

comment on column email_log.idempotency_key is
  'Unique per real-world event. Once-per-booking events key on booking:<booking_id>:<event_type>; events that can legitimately repeat (e.g. a generic status change) fold in the triggering row''s id too. Enforced by email_log_idempotency_key_idx -- a retried send for the same event hits this index instead of creating a duplicate row.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table email_log enable row level security;

-- email_log: admin-read only, same shape as audit_logs and
-- booking_notifications. No insert/update/delete policy at all -- see the
-- "WHO WRITES HERE" note above.
create policy "admins read email log" on email_log
  for select using (is_admin());

-- ---------------------------------------------------------------------------
-- updated_at trigger -- same explicit, per-table style as
-- booking_extensions_set_updated_at() (Phase 7); this codebase does not
-- use a shared generic trigger function.
-- ---------------------------------------------------------------------------
create or replace function email_log_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger email_log_set_updated_at_trigger
  before update on email_log
  for each row execute function email_log_set_updated_at();
