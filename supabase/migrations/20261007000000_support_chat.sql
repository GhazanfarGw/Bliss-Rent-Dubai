-- Support chat — turns the site-wide Support Chat widget's free-text path
-- (src/features/shared/SupportChatWidget.tsx) into a real two-way channel
-- instead of only scripted FAQ chips: a guest can describe a problem
-- (with an optional photo), it lands in the SAME admin inbox as the
-- Contact Us form (`complaints` — see 20260913000000_phase9h_submit_complaint.sql),
-- and an admin's reply — typed straight into ComplaintDetailPage — shows
-- up back in the guest's open chat panel via polling.
--
-- ARCHITECTURE: deliberately NOT a parallel ticketing system. `complaints`
-- already IS "the admin dashboard inbox for a customer-reported issue" —
-- this migration only adds what it was missing to carry a live back-and-
-- forth thread instead of one description + one emailed reply:
--
--  1. complaints.access_token — a second, dedicated bearer credential
--     (never complaints.id itself, which admins already see and share in
--     URLs/audit logs) that the guest's browser holds in localStorage to
--     read/post to its own thread with no login, the same "random token
--     stands in for a session" idea Manage Booking's reference-number
--     lookup already relies on elsewhere in this app.
--  2. complaint_messages — the actual thread (customer AND admin rows).
--     Both submit_complaint_public() (Contact Us form) and legacy
--     complaints predate this table and never wrote to it; their
--     description/admin_reply_message stay exactly as they are — the
--     admin thread view (ComplaintDetailPage) synthesizes those two as
--     the first/last bubble for older complaints instead of a backfill,
--     same additive-only posture as 20261005000000_complaint_admin_reply.sql.
--  3. A private 'complaint-attachments' storage bucket for the optional
--     photo — same "private, admin-read-only, service-role-only write"
--     posture as 'driver-documents' (Phase 0), since this can carry the
--     same kind of sensitive photo (ID, damage, documents).
--
-- Guest reads/writes are ALL Edge-Function-mediated (service_role only) —
-- support-chat-start / support-chat-message / support-chat-thread — same
-- "guest mutation needs a service-role key, not a direct anon grant"
-- convention as submit_complaint_public/create_booking. No RLS policy
-- below grants anon/authenticated anything at all; only is_admin() gets
-- direct table/storage access, exactly like every other admin-managed
-- table in this schema.

alter table complaints
  add column access_token uuid not null default gen_random_uuid();

create unique index complaints_access_token_idx on complaints (access_token);

comment on column complaints.access_token is
  'Bearer credential for the guest-facing Support Chat widget (never shown in the admin dashboard) — proves "this browser owns this conversation" to support-chat-message/support-chat-thread without any login. Deliberately separate from complaints.id, which admins already see and share.';

create table complaint_messages (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  uuid not null references complaints (id) on delete cascade,
  sender        text not null check (sender in ('customer', 'admin')),
  body          text,
  image_path    text,
  created_at    timestamptz not null default now(),
  constraint complaint_messages_body_or_image check (body is not null or image_path is not null)
);

create index complaint_messages_complaint_id_idx on complaint_messages (complaint_id, created_at);

comment on table complaint_messages is
  'The Support Chat thread for a complaints row — customer and admin messages, optionally with a photo (image_path, in the private complaint-attachments bucket). Complaints submitted before this table existed (the Contact Us form, and any legacy complaint) have no rows here; the admin thread view synthesizes complaints.description/admin_reply_message as bookend bubbles for those instead.';

alter table complaint_messages enable row level security;

create policy "admins manage complaint messages" on complaint_messages
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Storage: 'complaint-attachments' — private, admin-read-only, same
-- posture as 'driver-documents'. No insert/select policy for anon or
-- authenticated at all: every write goes through the service-role Edge
-- Functions below, which do not path-scope by complaint (unlike
-- driver-documents' per-booking folder check) since there is no client
-- read/write access to scope in the first place.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('complaint-attachments', 'complaint-attachments', false)
on conflict (id) do nothing;

create policy "admins read complaint attachments" on storage.objects
  for select using (bucket_id = 'complaint-attachments' and is_admin());
create policy "admins delete complaint attachments" on storage.objects
  for delete using (bucket_id = 'complaint-attachments' and is_admin());

-- ---------------------------------------------------------------------------
-- start_support_chat_public — opens a new conversation: upserts the guest
-- customer (identical idiom to submit_complaint_public), creates the
-- complaints row, and inserts the first complaint_messages row in one
-- transaction. Subject is auto-derived so the complaint reads as
-- chat-originated at a glance in ComplaintsListPage, without a schema
-- change to distinguish it from a Contact Us submission.
-- ---------------------------------------------------------------------------
create or replace function start_support_chat_public(
  p_customer_full_name text,
  p_customer_email     text,
  p_customer_phone     text,
  p_message            text,
  p_image_path         text
)
returns table (
  complaint_id  uuid,
  access_token  uuid,
  status        text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id  uuid;
  v_complaint_id uuid;
  v_access_token uuid;
begin
  if p_customer_full_name is null or btrim(p_customer_full_name) = '' then
    raise exception 'Please enter your name.' using errcode = '22023';
  end if;
  if p_customer_email is null or btrim(p_customer_email) = '' then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;
  if (p_message is null or btrim(p_message) = '') and (p_image_path is null or btrim(p_image_path) = '') then
    raise exception 'Please enter a message.' using errcode = '22023';
  end if;

  insert into customers (full_name, email, phone)
  values (p_customer_full_name, p_customer_email, p_customer_phone)
  on conflict (lower(email)) do update
    set full_name = excluded.full_name,
        phone = coalesce(excluded.phone, customers.phone)
  returning id into v_customer_id;

  insert into complaints (booking_id, customer_id, subject, description, status)
  values (
    null,
    v_customer_id,
    'Support chat: ' || left(coalesce(btrim(p_message), 'Photo attached'), 60),
    coalesce(btrim(p_message), 'Photo attached'),
    'open'
  )
  returning id, access_token into v_complaint_id, v_access_token;

  insert into complaint_messages (complaint_id, sender, body, image_path)
  values (v_complaint_id, 'customer', nullif(btrim(coalesce(p_message, '')), ''), p_image_path);

  insert into audit_logs (actor_id, action, entity_table, entity_id, metadata)
  values (
    null, 'complaint_submitted', 'complaints', v_complaint_id,
    jsonb_build_object('source', 'support_chat', 'customer_id', v_customer_id)
  );

  return query select v_complaint_id, v_access_token, 'open'::text;
end;
$$;

comment on function start_support_chat_public is
  'Support Chat widget''s "start a conversation" entry point — Edge-Function-mediated (service_role only), same architectural pattern as submit_complaint_public. Inserts a complaints row (booking_id left null, same reasoning as the Contact Us form) plus its first complaint_messages row, and returns the access_token the guest''s browser needs for every later read/post to this thread.';

revoke all on function start_support_chat_public(text, text, text, text, text) from public;
grant execute on function start_support_chat_public(text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- post_support_chat_message_public — appends a follow-up customer message
-- to an existing conversation, resolving the complaint by access_token
-- (never by complaint_id, which the guest is never given).
-- ---------------------------------------------------------------------------
create or replace function post_support_chat_message_public(
  p_access_token uuid,
  p_message      text,
  p_image_path   text
)
returns table (
  message_id  uuid,
  created_at  timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_complaint_id uuid;
  v_message_id   uuid;
  v_created_at   timestamptz;
begin
  if (p_message is null or btrim(p_message) = '') and (p_image_path is null or btrim(p_image_path) = '') then
    raise exception 'Please enter a message.' using errcode = '22023';
  end if;

  select id into v_complaint_id from complaints where access_token = p_access_token;
  if v_complaint_id is null then
    raise exception 'This conversation could not be found. Please start a new chat.' using errcode = '22023';
  end if;

  insert into complaint_messages (complaint_id, sender, body, image_path)
  values (v_complaint_id, 'customer', nullif(btrim(coalesce(p_message, '')), ''), p_image_path)
  returning id, created_at into v_message_id, v_created_at;

  return query select v_message_id, v_created_at;
end;
$$;

comment on function post_support_chat_message_public is
  'Support Chat widget''s "send a follow-up message" entry point — Edge-Function-mediated (service_role only). Resolves the conversation by access_token (never complaint_id), so only a browser that received the token from start_support_chat_public can post to it.';

revoke all on function post_support_chat_message_public(uuid, text, text) from public;
grant execute on function post_support_chat_message_public(uuid, text, text) to service_role;
