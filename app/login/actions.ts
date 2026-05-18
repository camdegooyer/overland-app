"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  const next = String(formData.get("redirect") ?? "/dashboard");

  if (!email) {
    redirect(`/login?error=missing-email&role=${role}`);
  }

  const supabase = await createClient();
  const headerList = await headers();
  const origin = headerList.get("origin") ?? deriveOrigin(headerList);
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  // TEMP: log so we can confirm what we're asking Supabase to redirect to.
  // Remove once magic link flow is fully wired.
  console.log("[sendMagicLink] origin:", origin, "emailRedirectTo:", emailRedirectTo);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(error.message)}&role=${role}`,
    );
  }

  redirect(`/login/sent?email=${encodeURIComponent(email)}&role=${role}`);
}

/**
 * Fallback when the request didn't include an Origin header (rare for form
 * submits, but possible). Picks http for localhost/127.0.0.1, https otherwise.
 * Respects x-forwarded-proto if a proxy set it.
 */
function deriveOrigin(headerList: Headers): string {
  const host = headerList.get("host") ?? "app.overlandbuilders.com.au";
  const forwardedProto = headerList.get("x-forwarded-proto");
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  const proto = forwardedProto ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}
