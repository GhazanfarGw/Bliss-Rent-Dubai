-- Minimal stand-in for the parts of Supabase's platform schema (auth, storage)
-- that our migrations reference, so migrations can be validated against a
-- plain local Postgres instance before being run on the real Supabase
-- project (which already has these schemas managed by Supabase itself).
-- This file is NOT part of the deployed migrations and is never run against
-- the live project.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Real Supabase projects grant anon/authenticated USAGE on schema auth and
-- EXECUTE on auth.uid() (that's the whole mechanism RLS policies rely on)
-- — without this grant, any RLS policy or trigger that calls auth.uid()
-- fails with "permission denied for schema auth" under a non-superuser
-- role, which is a stub gap, not a real product behavior.
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now()
);

-- Real Supabase enables RLS on storage.objects by default at the platform
-- level, before any migration ever runs. This stub creates the table
-- fresh, so it has to enable RLS explicitly too, or every storage policy
-- Phase 0 defines is silently never enforced against this local database.
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language plpgsql immutable
as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1:array_length(parts, 1) - 1];
end;
$$;

-- Real Supabase projects grant baseline object-level privileges to
-- anon/authenticated/service_role automatically (RLS then restricts at
-- the row level) — this stub has to do the same, or every table access
-- under `set local role authenticated` fails with a plain "permission
-- denied" before RLS even gets evaluated, which would hide real RLS bugs
-- behind a misleading unrelated error.
grant usage on schema public, storage to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant all on all sequences in schema storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
