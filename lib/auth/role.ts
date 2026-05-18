import { createAdminClient } from "@/lib/supabase/admin";

export type Role = "team" | "client" | "none";

export type RoleResolution = {
  role: Role;
  contactId: string | null;
  displayName: string | null;
};

/**
 * Map a logged-in user's email to a role in the Overland data model.
 *
 *   contacts.email → contact row
 *     ↳ employees.contact_id present → 'team'
 *     ↳ project_owners.contact_id present → 'client'
 *     ↳ neither → 'none'
 *
 * Team beats client if both match (an employee who also owns a project lands
 * on the team dashboard).
 */
export async function resolveRole(email: string): Promise<RoleResolution> {
  const admin = createAdminClient();
  const normalised = email.trim().toLowerCase();

  type ContactRow = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
  };

  const { data } = await admin
    .from("contacts")
    .select("id, first_name, last_name, preferred_name")
    .ilike("email", normalised)
    .maybeSingle();

  const contact = data as ContactRow | null;
  if (!contact) {
    return { role: "none", contactId: null, displayName: null };
  }

  const displayName =
    contact.preferred_name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    null;

  const [{ count: employeeCount }, { count: ownerCount }] = await Promise.all([
    admin
      .from("employees")
      .select("contact_id", { count: "exact", head: true })
      .eq("contact_id", contact.id),
    admin
      .from("project_owners")
      .select("contact_id", { count: "exact", head: true })
      .eq("contact_id", contact.id),
  ]);

  if ((employeeCount ?? 0) > 0) {
    return { role: "team", contactId: contact.id, displayName };
  }
  if ((ownerCount ?? 0) > 0) {
    return { role: "client", contactId: contact.id, displayName };
  }
  return { role: "none", contactId: contact.id, displayName };
}
