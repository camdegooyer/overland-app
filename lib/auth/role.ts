import { createAdminClient } from "@/lib/supabase/admin";

export type Role = "team" | "client" | "none";
export type TeamSubrole = "admin" | "staff";

export type RoleResolution = {
  role: Role;
  /** Only set when role = 'team'. Determines /team vs /me workspace. */
  subrole: TeamSubrole | null;
  contactId: string | null;
  employeeId: string | null;
  displayName: string | null;
};

/**
 * Map a logged-in user's email to a role in the Overland data model.
 *
 *   contacts.email → contact row
 *     ↳ employees.contact_id present → 'team' (+ subrole from employees.team_role)
 *     ↳ project_owners.contact_id present → 'client'
 *     ↳ neither → 'none'
 *
 * Team beats client if both match.
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
    return {
      role: "none",
      subrole: null,
      contactId: null,
      employeeId: null,
      displayName: null,
    };
  }

  const displayName =
    contact.preferred_name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    null;

  const [employeeRes, ownerRes] = await Promise.all([
    admin
      .from("employees")
      .select("id, team_role")
      .eq("contact_id", contact.id)
      .maybeSingle(),
    admin
      .from("project_owners")
      .select("contact_id", { count: "exact", head: true })
      .eq("contact_id", contact.id),
  ]);

  const employee = employeeRes.data as
    | { id: string; team_role: TeamSubrole }
    | null;

  if (employee) {
    return {
      role: "team",
      subrole: employee.team_role ?? "staff",
      contactId: contact.id,
      employeeId: employee.id,
      displayName,
    };
  }
  if ((ownerRes.count ?? 0) > 0) {
    return {
      role: "client",
      subrole: null,
      contactId: contact.id,
      employeeId: null,
      displayName,
    };
  }
  return {
    role: "none",
    subrole: null,
    contactId: contact.id,
    employeeId: null,
    displayName,
  };
}
