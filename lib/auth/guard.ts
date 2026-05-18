import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveRole, type Role, type TeamSubrole } from "@/lib/auth/role";

/**
 * Server-side guard: ensures the request is signed in AND has the expected role.
 * For team role, optionally also requires a specific subrole (admin / staff).
 * Returns the resolved user + role info for the page to use.
 *
 * If subrole is omitted, any team member passes (admin or staff).
 */
export async function requireRole(expected: Role, subrole?: TeamSubrole) {
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

  if (subrole && resolved.subrole !== subrole) {
    redirect("/dashboard");
  }

  return { user, ...resolved };
}

/** Shortcut: must be a team admin. Used for /team/* pages. */
export async function requireAdmin() {
  return requireRole("team", "admin");
}

/**
 * Shortcut: must be ANY team member (admin or staff). Used for /me/* pages.
 * Admin can still access /me but admin pages should use requireAdmin.
 */
export async function requireTeamMember() {
  return requireRole("team");
}
