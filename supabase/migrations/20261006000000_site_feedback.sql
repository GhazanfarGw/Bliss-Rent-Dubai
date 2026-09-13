-- Site-wide Feedback widget — a lightweight, always-available "how are we
-- doing?" channel (a 1-5 star rating + an optional message), shown as a
-- sticky button on every public page (see src/features/shared/
-- FeedbackWidget.tsx). Deliberately separate from `complaints` (Phase 0's
-- structured WhatsApp-support record, always tied to a customer) — this is
-- anonymous sentiment, not a support ticket: no name/email is collected,
-- and nothing here is linked to `customers` or `bookings`.
--
-- Same guest-mutation architecture as submit_complaint_public /
-- create_booking (see 20260913000000_phase9h_submit_complaint.sql): a
-- SECURITY DEFINER function, granted to service_role only, called from a
-- dedicated Edge Function (submit-feedback) that holds the service-role
-- key. anon/authenticated get no direct grant on the function, and no
-- insert policy on the table at all.

create table site_feedback (
  id          uuid primary key default gen_random_uuid(),
  rating      smallint not null check (rating between 1 and 5),
  message     text,
  page_path   text,
  locale      text,
  created_at  timestamptz not null default now()
);

create index site_feedback_created_at_idx on site_feedback (created_at desc);

comment on table site_feedback is 'Anonymous star rating + optional message from the site-wide Feedback widget (every public page). Not linked to customers/bookings on purpose — this is general visitor sentiment, not a support ticket (see `complaints` for that). Written only by submit_site_feedback_public(); read only by admins.';

alter table site_feedback enable row level security;

-- Admin-read only, same convention as audit_logs — nothing inserts here
-- directly from the client; guest submissions go through
-- submit_site_feedback_public() below (service_role only).
create policy "admins read site feedback" on site_feedback
  for select using (is_admin());

create or replace function submit_site_feedback_public(
  p_rating    integer,
  p_message   text,
  p_page_path text,
  p_locale    text
)
returns table (
  feedback_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feedback_id uuid;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Please choose a rating from 1 to 5 stars.' using errcode = '22023';
  end if;

  insert into site_feedback (rating, message, page_path, locale)
  values (
    p_rating,
    nullif(btrim(coalesce(p_message, '')), ''),
    nullif(btrim(coalesce(p_page_path, '')), ''),
    nullif(btrim(coalesce(p_locale, '')), '')
  )
  returning id into v_feedback_id;

  return query select v_feedback_id;
end;
$$;

comment on function submit_site_feedback_public is
  'Guest-facing entry point for the site-wide Feedback widget — Edge-Function-mediated (service_role only), same architectural pattern as submit_complaint_public/create_booking. Inserts one anonymous site_feedback row; never touches customers/bookings.';

revoke all on function submit_site_feedback_public(integer, text, text, text) from public;
grant execute on function submit_site_feedback_public(integer, text, text, text) to service_role;
