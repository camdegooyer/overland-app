"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Updates a rosterable subset of fields on public.employees.
 *
 * The base employees table is service-role-only (TFN, bank, DOB live there)
 * so we use the admin client. requireRole('team') gates the action — only a
 * signed-in team member can reach this code path.
 */

const Input = z.object({
  employee_id: z.string().uuid(),
  trade: z.string().trim().max(60).nullable().optional(),
  is_roster_employee: z.boolean().optional(),
  roster_sort_order: z.number().int().min(0).max(9999).optional(),
  notify_enabled: z.boolean().optional(),
});

export type UpdateEmployeeInput = z.infer<typeof Input>;

export async function updateEmployee(raw: UpdateEmployeeInput) {
  await requireAdmin();
  const input = Input.parse(raw);

  const patch: Record<string, unknown> = {};
  if ("trade" in input) patch.trade = input.trade?.length ? input.trade : null;
  if ("is_roster_employee" in input)
    patch.is_roster_employee = input.is_roster_employee;
  if ("roster_sort_order" in input)
    patch.roster_sort_order = input.roster_sort_order;
  if ("notify_enabled" in input) patch.notify_enabled = input.notify_enabled;

  if (Object.keys(patch).length === 0) {
    return { ok: true as const };
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from("employees") as any)
    .update(patch)
    .eq("id", input.employee_id);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/team/employees");
  return { ok: true as const };
}
