"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { logAudit, logAuditBatch } from "@/lib/roster/audit";
import {
  getRosterDayDefaults,
  getRosterSettings,
} from "@/lib/roster/queries";
import { isoDayOfWeek } from "@/lib/roster/dates";

/**
 * Pick the start/finish defaults for a given date: prefer the matching
 * roster_day_defaults row; fall back to the global roster_settings defaults.
 */
async function resolveDayDefaults(
  dateISO: string,
): Promise<{ start_time: string; finish_time: string }> {
  const [settings, dayDefaults] = await Promise.all([
    getRosterSettings(),
    getRosterDayDefaults(),
  ]);
  const dow = isoDayOfWeek(dateISO);
  const match = dayDefaults.find((d) => d.day_of_week === dow);
  return {
    start_time: match?.start_time ?? settings.default_start_time,
    finish_time: match?.finish_time ?? settings.default_finish_time,
  };
}

// --------------------------------------------------------- create card -------

const CreateInput = z.object({
  employee_id: z.string().uuid(),
  roster_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createEmployeeDayCard(raw: z.infer<typeof CreateInput>) {
  await requireAdmin();
  const input = CreateInput.parse(raw);

  const supabase = await createClient();
  const defaults = await resolveDayDefaults(input.roster_date);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("employee_day_cards") as any)
    .insert({
      employee_id: input.employee_id,
      roster_date: input.roster_date,
      start_time: defaults.start_time,
      finish_time: defaults.finish_time,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false as const,
        error: "That employee is already on the roster for this day.",
      };
    }
    return { ok: false as const, error: error.message };
  }

  await logAudit({
    entity_type: "employee_day_card",
    entity_id: data.id,
    action: "create",
    after: data,
  });

  revalidatePath("/team/roster");
  return { ok: true as const, data };
}

// --------------------------------------------------------- bulk create ------

const BulkCreateInput = z.object({
  employee_ids: z.array(z.string().uuid()).min(1).max(200),
  roster_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function bulkCreateEmployeeDayCards(
  raw: z.infer<typeof BulkCreateInput>,
) {
  await requireAdmin();
  const input = BulkCreateInput.parse(raw);

  const supabase = await createClient();
  const defaults = await resolveDayDefaults(input.roster_date);

  // Figure out which employees already have a card on that day so we don't
  // hit the unique-constraint and so the action is idempotent.
  const { data: existing, error: existingErr } = await supabase
    .from("employee_day_cards")
    .select("employee_id")
    .eq("roster_date", input.roster_date)
    .in("employee_id", input.employee_ids);
  if (existingErr) {
    return { ok: false as const, error: existingErr.message };
  }

  const alreadyOn = new Set(
    ((existing ?? []) as { employee_id: string }[]).map((r) => r.employee_id),
  );
  const toInsert = input.employee_ids.filter((id) => !alreadyOn.has(id));

  if (toInsert.length === 0) {
    return { ok: true as const, data: [] as never[] };
  }

  const rows = toInsert.map((employee_id) => ({
    employee_id,
    roster_date: input.roster_date,
    start_time: defaults.start_time,
    finish_time: defaults.finish_time,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("employee_day_cards") as any)
    .insert(rows)
    .select();

  if (error) return { ok: false as const, error: error.message };

  await logAuditBatch(
    (data ?? []).map((row: { id: string }) => ({
      entity_type: "employee_day_card" as const,
      entity_id: row.id,
      action: "create" as const,
      after: row,
    })),
  );

  revalidatePath("/team/roster");
  return { ok: true as const, data };
}

// --------------------------------------------------------- move card ---------

const MoveInput = z.object({
  card_id: z.string().uuid(),
  new_roster_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function moveEmployeeDayCard(raw: z.infer<typeof MoveInput>) {
  await requireAdmin();
  const input = MoveInput.parse(raw);

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("employee_day_cards")
    .select("*")
    .eq("id", input.card_id)
    .single();

  const beforeStatus = (before as { status?: string } | null)?.status;
  const patch: Record<string, unknown> = { roster_date: input.new_roster_date };
  if (beforeStatus === "published") patch.status = "changed";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("employee_day_cards") as any)
    .update(patch)
    .eq("id", input.card_id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false as const,
        error: "That employee already has a card on the target day.",
      };
    }
    return { ok: false as const, error: error.message };
  }

  await logAudit({
    entity_type: "employee_day_card",
    entity_id: data.id,
    action: "move",
    before,
    after: data,
  });

  revalidatePath("/team/roster");
  return { ok: true as const, data };
}

// --------------------------------------------------------- delete card -------

const DeleteInput = z.object({ card_id: z.string().uuid() });

export async function deleteEmployeeDayCard(raw: z.infer<typeof DeleteInput>) {
  await requireAdmin();
  const input = DeleteInput.parse(raw);

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("employee_day_cards")
    .select("*")
    .eq("id", input.card_id)
    .single();

  const { error } = await supabase
    .from("employee_day_cards")
    .delete()
    .eq("id", input.card_id);

  if (error) return { ok: false as const, error: error.message };

  await logAudit({
    entity_type: "employee_day_card",
    entity_id: input.card_id,
    action: "delete",
    before,
  });

  revalidatePath("/team/roster");
  return { ok: true as const };
}

// --------------------------------------------------------- update card -------

const Time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);

const UpdateInput = z.object({
  card_id: z.string().uuid(),
  start_time: Time.optional(),
  finish_time: Time.optional(),
  card_notes: z.string().nullable().optional(),
  status: z
    .enum(["draft", "published", "changed", "completed", "cancelled"])
    .optional(),
});

export async function updateEmployeeDayCard(raw: z.infer<typeof UpdateInput>) {
  await requireAdmin();
  const input = UpdateInput.parse(raw);

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("employee_day_cards")
    .select("*")
    .eq("id", input.card_id)
    .single();

  const patch: Record<string, unknown> = {};
  if ("start_time" in input) patch.start_time = input.start_time;
  if ("finish_time" in input) patch.finish_time = input.finish_time;
  if ("card_notes" in input)
    patch.card_notes = input.card_notes?.length ? input.card_notes : null;
  if ("status" in input) patch.status = input.status;

  if (Object.keys(patch).length === 0) return { ok: true as const };

  // Auto-flip published → changed so managers can see what's drifted since
  // the last publish. Skipped if the patch explicitly sets status.
  const beforeStatus = (before as { status?: string } | null)?.status;
  if (beforeStatus === "published" && !("status" in input)) {
    patch.status = "changed";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("employee_day_cards") as any)
    .update(patch)
    .eq("id", input.card_id)
    .select()
    .single();

  if (error) return { ok: false as const, error: error.message };

  await logAudit({
    entity_type: "employee_day_card",
    entity_id: data.id,
    action: "update",
    before,
    after: data,
  });

  revalidatePath("/team/roster");
  return { ok: true as const, data };
}
