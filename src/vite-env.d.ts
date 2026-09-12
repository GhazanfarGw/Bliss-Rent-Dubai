/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public Supabase project URL. Safe to expose to the browser. */
  readonly VITE_SUPABASE_URL: string
  /** Public Supabase anon key. Safe to expose to the browser — access is
   *  enforced by Row Level Security, not by keeping this secret. */
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
