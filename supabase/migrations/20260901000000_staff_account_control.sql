-- =============================================================================
-- Staff Account Control — the "Staff Accounts" screen (super_admin only).
--
-- Builds on 20260831000000_staff_role_restrictions.sql (is_super_admin()).
-- This migration adds the piece that was still a manual, developer-only
-- step: the owner can now add, suspend/reactivate, and promote/demote
-- staff accounts from inside the dashboard itself, with no SQL Editor
-- access required for day-to-day use.
--
-- Three parts:
--   1. `is_active` — a soft-suspend flag on admin_profiles. Suspending
--      someone does NOT delete their Supabase Auth login (so it's instantly
--      reversible), but is_admin()/is_super_admin() below now also require
--      is_active = true, so a suspended account loses access at the
--      database level immediately — every "admins manage X" policy in the
--      app runs through one of those two helpers. This mirrors the
--      Audit Log fix: enforced in the database, not just hidden in the UI.
--   2. Tightened RLS on admin_profiles itself. The original Phase 0 policy
--      ("admins manage admin profiles", `for all using (is_admin())`) let
--      ANY signed-in admin — including staff — insert/update/delete ANY
--      admin_profiles row directly from the browser (e.g.
--      `supabase.from('admin_profiles').update({role:'super_admin'})...`
--      via devtools). That was a latent gap while this table only had a
--      read-only directory; now that the dashboard actively writes to
--      this table (role changes, suspension), it must be closed. Writes
--      are now super_admin-only; reads are unchanged.
--   3. A guard trigger, independent of RLS, so a bug in the UI or a future
--      feature can never lock the business out of its own dashboard: an
--      admin can never change their OWN role or active flag, and the last
--      remaining active super_admin can never be demoted or suspended by
--      anyone.
--
-- Creating a brand-new staff login is NOT done through RLS/the client at
-- all — Supabase Auth user creation needs the service-role key, which the
-- browser never holds. See supabase/functions/admin-create-staff, the
-- Edge Function that does this instead, and re-checks super_admin status
-- itself from the caller's access token before touching anything.
-- =============================================================================

alter table admin_profiles
  add column if not exists is_active boolean not null default true;

comment on column admin_profiles.is_active is
  'Soft-suspend flag. false = the person keeps their Supabase Auth login (reversible any time) but is_admin()/is_super_admin() now return false for them, so every admin-only RLS policy in the app blocks them immediately — not just the dashboard UI.';

-- ---------------------------------------------------------------------------
-- 1. is_admin() / is_super_admin() now also require is_active.
-- ---------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from admin_profiles where id = auth.uid() and is_active = true
  );
$$;

create or replace function is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from admin_profiles where id = auth.uid() and role = 'super_admin' and is_active = true
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. admin_profiles writes: super_admin only (reads unchanged).
-- ---------------------------------------------------------------------------
drop policy if exists "admins manage admin profiles" on admin_profiles;

create policy "super admins insert admin profiles" on admin_profiles
  for insert with check (is_super_admin());

create policy "super admins update admin profiles" on admin_profiles
  for update using (is_super_admin()) with check (is_super_admin());

create policy "super admins delete admin profiles" on admin_profiles
  for delete using (is_super_admin());

-- ---------------------------------------------------------------------------
-- 3. Guard trigger — belt-and-braces, independent of RLS/the UI.
-- ---------------------------------------------------------------------------
create or replace function admin_profiles_guard_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nobody may change their own role or active flag — prevents any admin,
  -- including a super_admin, from ever locking themselves out (or quietly
  -- self-promoting) via a direct API call, whatever the RLS policy above
  -- says now or says in some future migration.
  if old.id = auth.uid() and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    raise exception 'You cannot change your own role or active status.';
  end if;

  -- Keep at least one active owner at all times.
  if old.role = 'super_admin' and old.is_active = true
     and (new.role <> 'super_admin' or new.is_active = false) then
    if (select count(*) from admin_profiles where role = 'super_admin' and is_active = true and id <> old.id) = 0 then
      raise exception 'At least one active owner account must remain.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists admin_profiles_guard_changes_trigger on admin_profiles;
create trigger admin_profiles_guard_changes_trigger
  before update on admin_profiles
  for each row execute function admin_profiles_guard_changes();
