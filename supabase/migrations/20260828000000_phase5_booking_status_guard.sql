-- ---------------------------------------------------------------------------
-- Phase 5 — Booking lifecycle hardening: status transition guard.
--
-- FINDING (live-DB audit, 2026-08-26): booking_status_history for the real
-- production booking d300ac89-03b4-4f51-93b9-49b7c3f235d7 shows the admin
-- "change status" dropdown (a plain RLS-governed UPDATE — see
-- adminBookingsApi.ts's updateBookingStatus, no separate status-mutation
-- path) was able to move the booking through an illegal sequence:
--   confirmed -> cancelled -> completed -> cancelled -> confirmed -> active
--   -> cancelled -> completed -> confirmed -> completed -> confirmed
-- Every one of those transitions was faithfully logged (the trigger's audit
-- trail is not the problem) but NONE of them were ever validated as legal.
-- completed and cancelled are meant to be terminal states; this let a
-- "completed" rental un-complete itself, and a "cancelled" booking silently
-- re-become "confirmed" while its date range still holds the
-- bookings_no_overlap exclusion lock against other customers.
--
-- FIX: extend the existing Phase 0/3 trigger function in place (same
-- trigger binding `bookings_status_change`, new body — the same pattern
-- Phase 3 already used to add the audit_logs insert) to reject any
-- transition outside the legal set below, BEFORE the row is written, so an
-- illegal transition never reaches booking_status_history or audit_logs.
--
-- Legal transitions:
--   pending_payment -> confirmed | cancelled
--   confirmed       -> active    | cancelled
--   active          -> completed | cancelled
--   completed, cancelled: terminal — no transitions out.
-- A same-status "update" (old = new) is not a transition at all and is
-- unaffected — it's already excluded by the enclosing
-- `old.status is distinct from new.status` guard, unchanged from Phase 0/3.
--
-- Blast radius checked before writing this: the only two code paths that
-- ever change bookings.status are confirm_payment() (pending_payment ->
-- confirmed only — legal) and adminBookingsApi.ts's updateBookingStatus
-- (now guarded). No frontend change is required: BookingDetailPage already
-- wraps updateBookingStatus in try/catch and renders the raised message in
-- its existing error banner (see updateError state) without any optimistic
-- UI update to roll back.
-- ---------------------------------------------------------------------------
create or replace function handle_booking_status_change()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if not (
      (old.status = 'pending_payment' and new.status in ('confirmed', 'cancelled')) or
      (old.status = 'confirmed'       and new.status in ('active', 'cancelled')) or
      (old.status = 'active'          and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'Illegal booking status transition: % -> %. Bookings can only move pending_payment -> confirmed/cancelled -> active -> completed/cancelled; completed and cancelled are terminal.', old.status, new.status
        using errcode = '23514';
    end if;

    insert into booking_status_history (booking_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());

    insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
    values (
      auth.uid(),
      'booking_status_changed',
      'bookings',
      new.id,
      jsonb_build_object('previous_status', old.status, 'new_status', new.status)
    );
  end if;
  return new;
end;
$$;

comment on function handle_booking_status_change() is
  'Phase 0/3/5. BEFORE UPDATE on bookings: stamps updated_at, rejects any status transition outside the legal booking lifecycle (raises 23514), and — only for legal transitions — logs booking_status_history and audit_logs. completed/cancelled are terminal.';
