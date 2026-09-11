-- =============================================================================
-- Admin dashboard login: mandatory emailed verification code (2026-09-05)
--
-- Owner request: no admin (staff or Super Admin) should be able to reach
-- the dashboard from a password alone — a 6-digit code emailed to their
-- own address must also be entered. Confirmed via AskUserQuestion: REAL
-- enforcement (not just a UI step) and applies to every admin login.
--
-- DESIGN: the browser never receives a usable Supabase Auth session until
-- the emailed code is verified. The password check still runs through
-- real Supabase Auth (supabase.auth.signInWithPassword, called from the
-- new admin-login-start Edge Function using the ANON key, exactly like
-- the browser would have called it directly before this change) — but
-- the resulting access_token/refresh_token are held HERE, server-side,
-- keyed by an opaque one-time `pending_token`, and are only ever handed
-- back to the browser by admin-login-verify, once the correct code has
-- been supplied. A stolen pending_token without the code is useless (it
-- only unlocks a code-guessing attempt, rate-limited below); a
-- stolen/leaked session token literally does not exist anywhere the
-- browser can reach until the code is correct.
--
-- This table is intentionally NOT protected by a security-definer RPC —
-- it is only ever touched by the two admin-login-* Edge Functions using
-- the SERVICE ROLE key (same "service-role Edge Function does the
-- privileged read/write directly" convention already used for
-- booking_notifications/audit_logs elsewhere in this schema). RLS is
-- still enabled with ZERO policies (default-deny) as pure defense in
-- depth, since the service role bypasses RLS anyway.
-- =============================================================================

create table admin_login_challenges (
  pending_token  uuid primary key default gen_random_uuid(),
  admin_user_id  uuid not null references auth.users (id) on delete cascade,
  code_hash      text not null,
  code_salt      text not null,
  access_token   text not null,
  refresh_token  text not null,
  attempts       integer not null default 0,
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);

comment on table admin_login_challenges is
  'Holds ONE pending admin login between the password check and the emailed-code confirmation. access_token/refresh_token are the real Supabase Auth session Supabase already issued for this login — held here, server-side, and handed to the browser (by admin-login-verify) ONLY after the correct code is entered. code_hash/code_salt: the 6-digit code itself is never stored in plaintext (sha256(code + salt)). Single-use and short-lived: deleted on successful verification, on reaching MAX_ATTEMPTS, or opportunistically once expired — see admin-login-start/logic.ts and admin-login-verify/logic.ts for the exact rules. Never exposed to anon/authenticated (RLS default-deny; only the service-role key, used exclusively by those two Edge Functions, ever reads or writes this table).';

comment on column admin_login_challenges.admin_user_id is
  'The auth.users id this pending login belongs to — already confirmed (by admin-login-start) to have an active admin_profiles row before this challenge row is ever created.';
comment on column admin_login_challenges.access_token is
  'The real Supabase Auth session access token from signInWithPassword(), held server-side until the code is verified. Never readable by anon/authenticated.';
comment on column admin_login_challenges.refresh_token is
  'The matching refresh token, same handling as access_token.';

alter table admin_login_challenges enable row level security;
-- Deliberately zero policies: default-deny for anon and authenticated.
-- Only the service-role key (used exclusively by admin-login-start and
-- admin-login-verify) can read or write this table.

revoke all on admin_login_challenges from anon, authenticated;

-- Index for the opportunistic cleanup sweep (delete-expired) both Edge
-- Functions run before writing/reading.
create index admin_login_challenges_expires_at_idx on admin_login_challenges (expires_at);
