-- =============================================================================
-- Phase 11 — Controlled booking status actions (replaces the unrestricted
-- admin status dropdown).
--
-- AUDIT FINDING that motivated this migration (see
-- claude/phase-11-premium-booking-admin-audit-and-plan-2026-09-02.md):
-- BookingDetailPage.tsx previously rendered a plain <select> offering all
-- five booking statuses, wired to a bare `supabase.from('bookings').update
-- ({status})` (adminBookingsApi.ts's old updateBookingStatus()). The only
-- server-side guard was handle_booking_status_change()'s pure status-graph
-- check (pending_payment->confirmed|cancelled, confirmed->active|cancelled,
-- active->completed|cancelled) — it has NO awareness of payments.status.
-- Combined with the "admins manage bookings" FOR ALL RLS policy (any active
-- admin, staff included, via is_admin()), this meant any admin could set a
-- booking to 'confirmed' with its payment still 'pending'/'failed' — the
-- exact invalid state the owner's brief explicitly names. This is exactly
-- what produced the BLS-E16F5DC3 inconsistency earlier this session (a
-- direct manual status change, not the new payment-confirm feature).
--
-- Owner's explicit decisions (asked via AskUserQuestion, 2026-09-02):
--  1. Every manual status transition becomes Super-Admin-only (matches the
--     existing cash-extension / cash-payment-confirmation pattern).
--  2. confirmed->active and active->completed get named, controlled actions
--     ("Start Rental" / "Mark Returned") instead of being left as a plain
--     dropdown pick with no supporting business rule.
--
-- What this migration does:
--  1. Narrows the bookings RLS policy: admins keep SELECT/INSERT/DELETE,
--     but lose direct UPDATE. Every remaining code path that updates a
--     booking's status/fields already goes through a SECURITY DEFINER RPC
--     (create_booking, confirm_payment, admin_confirm_booking_payment,
--     request_booking_extension, etc.) — this migration adds the three
--     that were missing (cancel / start rental / mark returned) so no gap
--     is left where a direct table UPDATE was the only path. Per the
--     brief's own instruction: "Frontend restrictions are NOT sufficient.
--     Database/RPC authorization remains authoritative."
--  2. Three new Super-Admin-only RPCs, mirroring admin_confirm_booking_
--     payment's exact shape (idempotent-safe precondition checks, a plain
--     UPDATE that the existing handle_booking_status_change trigger still
--     validates and auto-logs to booking_status_history + a generic
--     audit_logs row, PLUS a richer named audit_logs row from the RPC
--     itself, same pattern already used there).
--
-- Explicitly NOT changed: pricing, availability, create_booking,
-- confirm_payment, the bookings_no_overlap constraint, extension logic,
-- vehicles.status (rental availability is date-range based, not a mutable
-- vehicle flag — confirmed via information_schema: vehicle_status enum is
-- only {available, maintenance, retired}, a fleet-management concept
-- unrelated to per-booking rental state), email logic (the existing
-- cancellation emails stay wired at the frontend layer, unchanged), and
-- handle_booking_status_change() itself (its transition graph already
-- permits every transition these RPCs need).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Narrow the bookings RLS policy: admins keep SELECT/INSERT/DELETE,
-- lose direct UPDATE (grep-confirmed: the only client code that ever
-- issued a raw `bookings` UPDATE was the dropdown being removed in this
-- same phase).
-- ---------------------------------------------------------------------------
drop policy if exists "admins manage bookings" on bookings;

create policy "admins select bookings" on bookings
  for select
  using (is_admin());

create policy "admins insert bookings" on bookings
  for insert
  with check (is_admin());

create policy "admins delete bookings" on bookings
  for delete
  using (is_admin());

comment on table bookings is
  'Booking status updates are NOT permitted via direct RLS UPDATE for admins as of Phase 11 — every status transition must go through a SECURITY DEFINER RPC (confirm_payment, admin_confirm_booking_payment, admin_cancel_booking, admin_start_rental, admin_mark_returned) so authorization and the state-machine trigger are always enforced together, never bypassable from the client.';

-- ---------------------------------------------------------------------------
-- 2. admin_cancel_booking — Super-Admin-only. Allowed from any non-terminal
-- status (pending_payment, confirmed, active), matching the trigger's own
-- ...->cancelled edges. Terminal statuses (completed, cancelled) rejected
-- with a clear message.
-- ---------------------------------------------------------------------------
create or replace function admin_cancel_booking(
  p_booking_id uuid,
  p_note       text default null
)
returns table (booking_id uuid, booking_status booking_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
begin
  if not is_super_admin() then
    raise exception 'Only a Super Admin can cancel a booking.';
  end if;

  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status = 'cancelled' then
    return query select v_booking.id, v_booking.status;
    return;
  end if;

  if v_booking.status not in ('pending_payment', 'confirmed', 'active') then
    raise exception 'A booking that is % cannot be cancelled.', v_booking.status;
  end if;

  update bookings set status = 'cancelled' where id = v_booking.id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (
    auth.uid(),
    'booking_cancelled_by_admin',
    'bookings',
    v_booking.id,
    jsonb_build_object('previous_status', v_booking.status, 'note', p_note)
  );

  return query select v_booking.id, 'cancelled'::booking_status;
end;
$$;

comment on function admin_cancel_booking is
  'Super-Admin-only controlled cancel action, replacing the old unrestricted status dropdown. Allowed from pending_payment, confirmed, or active only (matches handle_booking_status_change''s own ...->cancelled edges). Idempotent on an already-cancelled booking. Frontend still fires the existing customer/admin cancellation emails after this succeeds, unchanged from before.';

revoke all on function admin_cancel_booking(uuid, text) from public;
grant execute on function admin_cancel_booking(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. admin_start_rental — Super-Admin-only. confirmed -> active only. No
-- existing business rule governed this transition before (it was purely a
-- dropdown pick) — this migration only adds authorization + a named audit
-- trail, it does not invent any new pricing/availability rule.
-- ---------------------------------------------------------------------------
create or replace function admin_start_rental(
  p_booking_id uuid,
  p_note       text default null
)
returns table (booking_id uuid, booking_status booking_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
begin
  if not is_super_admin() then
    raise exception 'Only a Super Admin can start a rental.';
  end if;

  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status = 'active' then
    return query select v_booking.id, v_booking.status;
    return;
  end if;

  if v_booking.status <> 'confirmed' then
    raise exception 'Only a confirmed booking can start its rental (current status: %).', v_booking.status;
  end if;

  update bookings set status = 'active' where id = v_booking.id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (
    auth.uid(),
    'booking_rental_started_by_admin',
    'bookings',
    v_booking.id,
    jsonb_build_object('previous_status', v_booking.status, 'note', p_note)
  );

  return query select v_booking.id, 'active'::booking_status;
end;
$$;

comment on function admin_start_rental is
  'Super-Admin-only controlled confirmed->active transition ("Start Rental"), replacing the old unrestricted status dropdown for this edge. Idempotent on an already-active booking.';

revoke all on function admin_start_rental(uuid, text) from public;
grant execute on function admin_start_rental(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. admin_mark_returned — Super-Admin-only. active -> completed only.
-- Same rationale as admin_start_rental above.
-- ---------------------------------------------------------------------------
create or replace function admin_mark_returned(
  p_booking_id uuid,
  p_note       text default null
)
returns table (booking_id uuid, booking_status booking_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
begin
  if not is_super_admin() then
    raise exception 'Only a Super Admin can mark a rental as returned.';
  end if;

  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status = 'completed' then
    return query select v_booking.id, v_booking.status;
    return;
  end if;

  if v_booking.status <> 'active' then
    raise exception 'Only an active rental can be marked as returned (current status: %).', v_booking.status;
  end if;

  update bookings set status = 'completed' where id = v_booking.id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (
    auth.uid(),
    'booking_marked_returned_by_admin',
    'bookings',
    v_booking.id,
    jsonb_build_object('previous_status', v_booking.status, 'note', p_note)
  );

  return query select v_booking.id, 'completed'::booking_status;
end;
$$;

comment on function admin_mark_returned is
  'Super-Admin-only controlled active->completed transition ("Mark Returned"), replacing the old unrestricted status dropdown for this edge. Idempotent on an already-completed booking.';

revoke all on function admin_mark_returned(uuid, text) from public;
grant execute on function admin_mark_returned(uuid, text) to authenticated;
