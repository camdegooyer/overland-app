import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with the service-role key.
 * Bypasses RLS. Never expose to the browser. Use sparingly — currently only
 * for role resolution (mapping auth.user.email → contacts/employees/owners).
 *
 * Long-term: replace with narrow RLS policies that let an authenticated user
 * read their own contact row, then drop this helper.
 */
let cached: ReturnType<typeof createSupabaseClient> | null = null;

export function createAdminClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Set both in .env.local (and in Vercel Project Settings → Environment Variables for production).",
    );
  }

  cached = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
