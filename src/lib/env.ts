/**
 * Central place that reads and validates public (frontend-safe) environment
 * variables. Fails fast and loudly on startup if something is missing,
 * rather than letting a blank Supabase client fail mysteriously later.
 *
 * IMPORTANT: only ever add variables here that are safe to ship to the
 * browser. Anything secret (service role key, payment secret keys, etc.)
 * belongs server-side only — see docs/ARCHITECTURE.md.
 */
function requireEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env.local and fill it in.`,
    )
  }
  return value
}

export const env = {
  supabaseUrl: requireEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('VITE_SUPABASE_ANON_KEY'),
} as const
