// Phase 0 placeholder Edge Function.
//
// Purpose: establish the pattern (Deno runtime, service-role access,
// CORS handling) that later phases will reuse for privileged operations —
// e.g. confirming a payment, or an admin-only bulk action — that must
// never run with a user's own (RLS-limited) credentials on the client.
//
// This function does no business logic yet. It only proves the
// Functions setup is wired correctly.

import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Server-side only client using the service role key. This key must
  // NEVER be sent to or read by the frontend — it is only available to
  // Edge Functions via the Supabase-managed environment.
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { error } = await supabaseAdmin
    .from('vehicle_categories')
    .select('id', { count: 'exact', head: true })

  return new Response(
    JSON.stringify({
      status: error ? 'error' : 'ok',
      error: error?.message ?? null,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error ? 500 : 200,
    },
  )
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
