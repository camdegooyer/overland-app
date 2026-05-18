"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";

const Hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a hex like #f96900");
const Time = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "HH:MM");

const Input = z.object({
  project_id: z.string().uuid(),
  show_in_side_panel: z.boolean().optional(),
  colour: Hex.optional(),
  display_name: z.string().trim().max(120).nullable().optional(),
  default_start_time: Time.nullable().optional(),
  default_finish_time: Time.nullable().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

export type UpsertProjectRosterMetaInput = z.infer<typeof Input>;

/**
 * Upsert project_roster_meta. authenticated has full RLS on this table, so we
 * can use the user-scoped client.
 */
export async function upsertProjectRosterMeta(
  raw: UpsertProjectRosterMetaInput,
) {
  await requireRole("team");
  const input = Input.parse(raw);

  const supabase = await createClient();

  const row: Record<string, unknown> = { project_id: input.project_id };
  if ("show_in_side_panel" in input)
    row.show_in_side_panel = input.show_in_side_panel;
  if ("colour" in input) row.colour = input.colour;
  if ("display_name" in input)
    row.display_name = input.display_name?.length ? input.display_name : null;
  if ("default_start_time" in input)
    row.default_start_time = input.default_start_time || null;
  if ("default_finish_time" in input)
    row.default_finish_time = input.default_finish_time || null;
  if ("sort_order" in input) row.sort_order = input.sort_order;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("project_roster_meta") as any).upsert(
    row,
    { onConflict: "project_id" },
  );

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/team/jobs");
  return { ok: true as const };
}
