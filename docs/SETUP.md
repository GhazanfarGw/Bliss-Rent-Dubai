# Development setup

## Prerequisites

- Node.js 20+ and npm
- A Supabase account (https://supabase.com) — free tier is enough for dev
- The Supabase CLI, if you want to run migrations from the command line:
  `npm install -g supabase` or see https://supabase.com/docs/guides/cli

## 1. Install frontend dependencies

```bash
npm install
```

## 2. Create a Supabase project

1. Create a new project at https://supabase.com/dashboard.
2. Grab the **Project URL** and **anon public key** from
   Project Settings → API.
3. Grab the **service role key** from the same page — this one is secret,
   never put it in `.env.local` or anything under `VITE_*`.

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 2.
Leave the service-role key out of `.env.local` entirely — it's only used
by Edge Functions, configured separately (step 5).

## 4. Apply the database schema

Option A — Supabase CLI (recommended):

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push        # applies everything in supabase/migrations/
supabase db seed        # applies supabase/seed/seed.sql (dev/staging only — reference data, not fake bookings)
```

Option B — manual: paste the contents of
`supabase/migrations/20260824000000_phase0_foundation.sql` into the
Supabase Dashboard's SQL Editor and run it, then do the same for
`supabase/seed/seed.sql` if you want the two starter vehicle categories
and airport locations.

## 5. (When needed) Deploy Edge Functions

```bash
supabase functions deploy health
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 6. Run the app

```bash
npm run dev
```

Visit http://localhost:5173. You should see a "Connected to Supabase"
status message. If you see a connection error instead, double-check
`.env.local` and that the migration was applied successfully.

## Creating your first admin user

There's no admin-signup UI yet (Phase 1+). Until then, promote a user to
admin manually:

1. Have them sign up through Supabase Auth (or create the user in the
   Dashboard → Authentication → Users).
2. Insert a matching row into `admin_profiles`:
   ```sql
   insert into admin_profiles (id, full_name, role)
   values ('<their auth.users id>', 'Their Name', 'super_admin');
   ```
