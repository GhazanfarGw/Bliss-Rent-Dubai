/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public Supabase project URL. Safe to expose to the browser. */
  readonly VITE_SUPABASE_URL: string
  /** Public Supabase anon key. Safe to expose to the browser — access is
   *  enforced by Row Level Security, not by keeping this secret. */
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Optional marketing tags — each tag is skipped when its id is unset. */
  readonly VITE_GA4_ID?: string
  readonly VITE_GADS_ID?: string
  readonly VITE_GADS_LABEL_WHATSAPP?: string
  readonly VITE_GADS_LABEL_BOOKING?: string
  readonly VITE_META_PIXEL_ID?: string
  readonly VITE_GTM_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
