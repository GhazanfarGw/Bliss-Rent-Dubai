import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { env } from '@/lib/env'

/**
 * The ONLY Supabase client the frontend should ever create. It uses the
 * public anon key — safe to ship to the browser because every table is
 * protected by Row Level Security (see supabase/migrations).
 *
 * Never construct a client with the service role key here or anywhere
 * else in src/. The service role key belongs exclusively to Edge
 * Functions (supabase/functions) and must never reach the browser.
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey)
