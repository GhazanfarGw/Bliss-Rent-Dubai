-- Task 3 (2026-09-11 scoped update) — activates the existing Contact Us
-- -> Complaints/Operations flow's missing last step: an admin reply that
-- actually reaches the customer's email.
--
-- BACKGROUND: submit_complaint_public() (Phase 9H) already gets a guest's
-- Contact Us message into `complaints`, and "admins manage complaints"
-- (Phase 0) already lets an authenticated admin update it (status,
-- internal_notes, resolution — see adminComplaintsApi.ts). What has never
-- existed is a way for that admin's response to be emailed back to the
-- customer. `internal_notes` is explicitly staff-only ("never shown to
-- the customer" — its own Phase 3 comment) and `resolution` is an
-- internal summary, so reusing either as customer-facing copy would
-- silently repurpose a field whose documented meaning says otherwise.
-- This migration adds exactly two new, clearly-scoped columns instead.
--
-- ADDITIVE ONLY. No existing column, constraint, RLS policy, or trigger
-- on `complaints` is touched. "admins manage complaints" (`for all using
-- is_admin() with check is_admin()`) already covers admins writing these
-- two new columns — no new policy, no new RPC needed for the save step.
-- Sending the actual email still needs a service-role Edge Function
-- (Resend API key never reaches the browser) — see
-- supabase/functions/deliver-complaint-reply/, which reads these columns
-- back rather than trusting client-supplied text at send time, same
-- security posture as every other outbound email in this codebase.
alter table complaints
  add column admin_reply_message text,
  add column admin_reply_sent_at timestamptz;

comment on column complaints.admin_reply_message is
  'The admin''s reply text, emailed to the customer''s complaints.customer_id email once saved. Distinct from resolution (an internal summary) and internal_notes (staff-only, never shown to the customer) -- this column IS shown to the customer, verbatim, by deliver-complaint-reply.';
comment on column complaints.admin_reply_sent_at is
  'Set by the admin dashboard (ComplaintDetailPage) at the moment a reply is saved -- also doubles as the deliver-complaint-reply Edge Function''s idempotency discriminator (see buildComplaintEventKey(complaintId, ''admin_complaint_reply'', admin_reply_sent_at)), so a retried notify call for the same saved reply can never send twice, while a genuinely new reply (a fresh timestamp) always can.';
