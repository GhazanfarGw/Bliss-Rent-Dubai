# Dubai Airport Car Rental — Platform

Website-only booking platform for an airport-based car rental service
covering Dubai and Abu Dhabi. WhatsApp is support-only, not a booking
channel. Full context in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Status: Phase 0 — Project Foundation & Architecture.** No booking UI,
admin dashboard, payment integration, or WhatsApp integration exists yet.
This phase establishes the frontend scaffold, the database schema, and
the security model those later phases build on.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4 + React Router
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **No other database.** All persistence is Supabase Postgres.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project's URL/anon key
npm run dev
```

Open http://localhost:5173 — you should see a Phase 0 status screen
confirming the Supabase connection (it will show a connection error until
`.env.local` points at a real project with the migration applied).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run lint` | Run oxlint over the codebase |
| `npm run preview` | Preview the production build locally |

## Database

Schema and Row Level Security policies live in
[`supabase/migrations/`](supabase/migrations/). See
[`docs/DATABASE.md`](docs/DATABASE.md) for the full table-by-table
reference, and [`docs/SETUP.md`](docs/SETUP.md) for how to stand up a
Supabase project and apply the migration.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture and the business decisions it encodes
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema reference
- [`docs/SETUP.md`](docs/SETUP.md) — environment & Supabase setup instructions
