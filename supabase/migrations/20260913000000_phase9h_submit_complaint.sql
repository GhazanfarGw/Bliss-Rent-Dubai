-- Phase 9H — the guest-facing entry point for the Contact Us form.
--
-- Background: the `complaints` table (Phase 0) was designed for staff to
-- log WhatsApp support conversations ("WHATSAPP IS THE CHANNEL, NOT THE
-- STORAGE" — see its table comment), so its only insert policy requires a
-- real Supabase Auth session (`customers.auth_user_id = auth.uid()`).
-- This app is guest checkout by design, so that session essentially never
-- exists for a real customer — there has never been a working path for a
-- guest's own message to reach this table.
--
-- This migration adds exactly one thing: a guest mutation entry point for
-- the Contact Us form, following the SAME architectural pattern already
-- used for every other guest mutation in this codebase (create_booking,
-- submit_extension_request_public) — a SECURITY DEFINER function, granted
-- to service_role only, called from a dedicated Edge Function that holds
-- the service-role key. It does not touch the `complaints` table's
-- existing RLS policies at all (they keep governing direct
-- authenticated/admin access exactly as before) — this function bypasses
-- them the same structural way create_booking() already bypasses RLS on
-- `bookings`/`customers` for a guest checkout.
--
-- Reuses the exact guest-customer upsert idiom from create_booking()
-- (Phase 2): find-or-create by the case-insensitive email unique index.

create or replace function submit_complaint_public(
  p_customer_full_name text,
  p_customer_email     text,
  p_customer_phone     text,
  p_subject            text,
  p_description        text
)
returns table (
  complaint_id uuid,
  status       text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id  uuid;
  v_complaint_id uuid;
  v_subject      text;
begin
  if p_customer_full_name is null or btrim(p_customer_full_name) = '' then
    raise exception 'Please enter your name.' using errcode = '22023';
  end if;
  if p_customer_email is null or btrim(p_customer_email) = '' then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;
  if p_description is null or btrim(p_description) = '' then
    raise exception 'Please enter a message.' using errcode = '22023';
  end if;

  -- `complaints.subject` is NOT NULL, but the Contact Us form has never
  -- required a subject (it's an optional field client-side, matching the
  -- existing ContactPage.tsx validation, which this migration does not
  -- change). A blank subject falls back to a plain, non-invented label
  -- rather than rejecting a message the form itself accepts.
  v_subject := coalesce(nullif(btrim(p_subject), ''), 'Message from Contact Us form');

  -- Find-or-create the guest customer — identical idiom to create_booking()
  -- in 20260826000000_phase2_booking_checkout.sql.
  insert into customers (full_name, email, phone)
  values (p_customer_full_name, p_customer_email, p_customer_phone)
  on conflict (lower(email)) do update
    set full_name = excluded.full_name,
        phone = coalesce(excluded.phone, customers.phone)
  returning id into v_customer_id;

  -- booking_id is left null on purpose: the Contact Us form is a general
  -- inquiry channel, not tied to any one booking (the column is nullable
  -- for exactly this reason — see its Phase 0 definition). A future,
  -- separately-scoped change could add an optional booking-reference
  -- field to the form itself; this migration does not add one, since
  -- ContactPage.tsx's fields are unchanged here.
  insert into complaints (booking_id, customer_id, subject, description, status)
  values (null, v_customer_id, v_subject, btrim(p_description), 'open')
  returning id into v_complaint_id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (
    null, 'complaint_submitted', 'complaints', v_complaint_id,
    jsonb_build_object('source', 'contact_form', 'customer_id', v_customer_id)
  );

  return query select v_complaint_id, 'open'::text;
end;
$$;

comment on function submit_complaint_public is
  'The Contact Us form''s guest-facing entry point — Edge-Function-mediated (service_role only), same architectural pattern as create_booking/submit_extension_request_public: a guest mutation needs a service-role key, not a direct anon grant. Inserts a complaints row with status ''open'' and booking_id left null (general inquiry, not booking-specific). Does not change the complaints table''s existing RLS policies — those keep governing direct authenticated/admin access exactly as before.';

revoke all on function submit_complaint_public(text, text, text, text, text) from public;
grant execute on function submit_complaint_public(text, text, text, text, text) to service_role;
