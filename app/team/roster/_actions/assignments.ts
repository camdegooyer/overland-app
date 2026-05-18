"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/roster/audit";

// --------------------------------------------------------- create ------------

const Time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);

const CreateInput = z
  .object({
    employee_day_card_id: z.string().uuid(),
    project_id: z.string().uuid().optional(),
    other_item_id: z.string().uuid().optional(),
    // Optional time overrides for split-day prompts. If omitted, fall back to
    // project defaults or card times.
    start_time: Time.optional(),
    finish_time: Time.optional(),
  })
  .refine(
    (v) =>
      (v.project_id && !v.other_item_id) || (!v.project_id && v.other_item_id),
    {
      message: "Exactly one of project_id or other_item_id must be set.",
    },
  );

export async function createRosterAssignment(raw: z.infer<typeof CreateInput>) {
  await requireRole("team");
  const input = CreateInput.parse(raw);

  const supabase = await createClient();

  // Look up the parent card to inherit times if none supplied.
  const { data: card, error: cardErr } = await supabase
    .from("employee_day_cards")
    .select("start_time, finish_time")
    .eq("id", input.employee_day_card_id)
    .single();
  if (cardErr || !card) {
    return { ok: false as const, error: "Card not found." };
  }

  let startTime = input.start_time;
  let finishTime = input.finish_time;

  if (!startTime || !finishTime) {
    // Project-typed assignments fall back to project defaults; other-typed
    // assignments don't have per-item defaults (yet) and fall straight to the
    // card times.
    if (input.project_id) {
      const { data: projectMeta } = await supabase
        .from("project_roster_meta")
        .select("default_start_time, default_finish_time")
        .eq("project_id", input.project_id)
        .maybeSingle();
      const pm = projectMeta as
        | {
            default_start_time: string | null;
            default_finish_time: string | null;
          }
        | null;
      startTime =
        startTime ??
        pm?.default_start_time ??
        (card as { start_time: string }).start_time;
      finishTime =
        finishTime ??
        pm?.default_finish_time ??
        (card as { finish_time: string }).finish_time;
    } else {
      startTime = startTime ?? (card as { start_time: string }).start_time;
      finishTime = finishTime ?? (card as { finish_time: string }).finish_time;
    }
  }

  if (finishTime <= startTime) {
    return {
      ok: false as const,
      error: "Finish time must be after start time.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("roster_assignments") as any)
    .insert({
      employee_day_card_id: input.employee_day_card_id,
      project_id: input.project_id ?? null,
      other_item_id: input.other_item_id ?? null,
      start_time: startTime,
      finish_time: finishTime,
    })
    .select()
    .single();

  if (error) return { ok: false as const, error: error.message };

  await logAudit({
    entity_type: "roster_assignment",
    entity_id: data.id,
    action: "create",
    after: data,
  });

  revalidatePath("/team/roster");
  return { ok: true as const, data };
}

// --------------------------------------------------------- move --------------

const MoveInput = z.object({
  assignment_id: z.string().uuid(),
  new_employee_day_card_id: z.string().uuid(),
});

export async function moveRosterAssignment(raw: z.infer<typeof MoveInput>) {
  await requireRole("team");
  const input = MoveInput.parse(raw);

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("roster_assignments")
    .select("*")
    .eq("id", input.assignment_id)
    .single();

  const beforeStatus = (before as { status?: string } | null)?.status;
  const patch: Record<string, unknown> = {
    employee_day_card_id: input.new_employee_day_card_id,
  };
  if (beforeStatus === "published") patch.status = "changed";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("roster_assignments") as any)
    .update(patch)
    .eq("id", input.assignment_id)
    .select()
    .single();

  if (error) return { ok: false as const, error: error.message };

  await logAudit({
    entity_type: "roster_assignment",
    entity_id: data.id,
    action: "move",
    before,
    after: data,
  });

  revalidatePath("/team/roster");
  return { ok: true as const, data };
}

// --------------------------------------------------------- delete ------------

const DeleteInput = z.object({ assignment_id: z.string().uuid() });

export async function deleteRosterAssignment(raw: z.infer<typeof DeleteInput>) {
  await requireRole("team");
  const input = DeleteInput.parse(raw);

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("roster_assignments")
    .select("*")
    .eq("id", input.assignment_id)
    .single();

  const { error } = await supabase
    .from("roster_assignments")
    .delete()
    .eq("id", input.assignment_id);

  if (error) return { ok: false as const, error: error.message };

  await logAudit({
    entity_type: "roster_assignment",
    entity_id: input.assignment_id,
    action: "delete",
    before,
  });

  revalidatePath("/team/roster");
  return { ok: true as const };
}

// --------------------------------------------------------- update ------------

const UpdateInput = z.object({
  assignment_id: z.string().uuid(),
  start_time: Time.optional(),
  finish_time: Time.optional(),
  area: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z
    .enum(["draft", "published", "changed", "completed", "cancelled"])
    .optional(),
});

export async function updateRosterAssignment(raw: z.infer<typeof UpdateInput>) {
  await requireRole("team");
  const input = UpdateInput.parse(raw);

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("roster_assignments")
    .select("*")
    .eq("id", input.assignment_id)
    .single();

  const patch: Record<string, unknown> = {};
  if ("start_time" in input) patch.start_time = input.start_time;
  if ("finish_time" in input) patch.finish_time = input.finish_time;
  if ("area" in input) patch.area = input.area?.length ? input.area : null;
  if ("notes" in input) patch.notes = input.notes?.length ? input.notes : null;
  if ("status" in input) patch.status = input.status;

  if (Object.keys(patch).length === 0) return { ok: true as const };

  // Auto-flip published → changed so managers can see what's drifted since
  // the last publish. Skipped if the patch explicitly sets status.
  const beforeStatus = (before as { status?: string } | null)?.status;
  if (beforeStatus === "published" && !("status" in input)) {
    patch.status = "changed";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("roster_assignments") as any)
    .update(patch)
    .eq("id", input.assignment_id)
    .select()
    .single();

  if (error) return { ok: false as const, error: error.message };

  await logAudit({
    entity_type: "roster_assignment",
    entity_id: data.id,
    action: "update",
    before,
    after: data,
  });

  revalidatePath("/team/roster");
  return { ok: true as const, data };
}
