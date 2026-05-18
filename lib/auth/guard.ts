import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveRole, type Role } from "@/lib/auth/role";

/**
 * Server-side guard: ensures the request is signed in AND has the expected role.
 * Returns the resolved user + role info for the page to use.
 */
export async function requireRole(expected: Role) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  const resolved = await resolveRole(user.email);

  if (resolved.role !== expected) {
    redirect("/dashboard");
  }

  return { user, ...resolved };
}
