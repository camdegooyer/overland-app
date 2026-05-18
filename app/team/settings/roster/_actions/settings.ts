"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const Time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "HH:MM or HH:MM:SS");

const DayDefault = z.object({
  day_of_week: z.number().int().min(1).max(7),
  start_time: Time,
  finish_time: Time,
});

const Input = z.object({
  default_break_minutes: z.number().int().min(0).max(240),
  default_split_start_time: Time,
  week_starts_on: z.number().int().min(1).max(7),
  show_weekends: z.boolean(),
  day_defaults: z.array(DayDefault).length(7),
});

export type RosterSettingsInput = z.infer<typeof Input>;

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function normaliseTime(t: string): string {
  // Postgres TIME returns "HH:MM:SS"; the form sends "HH:MM". Compare on the
  // 5-char prefix so both round-trip cleanly.
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export async function updateRosterSettings(raw: RosterSettingsInput) {
  await requireRole("team");
  const input = Input.parse(raw);

  // Client-side-style validation: collect every bad day up front so the user
  // sees them all at once instead of one-at-a-time.
  const validationErrors: string[] = [];
  for (const d of input.day_defaults) {
    if (normaliseTime(d.finish_time) <= normaliseTime(d.start_time)) {
      validationErrors.push(
        `${DAY_NAMES[d.day_of_week - 1]}: finish must be after start.`,
      );
    }
  }
  if (validationErrors.length > 0) {
    return {
      ok: false as const,
      error: validationErrors.join(" "),
    };
  }

  const admin = createAdminClient();

  // Update global settings.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: settingsErr } = await (admin.from("roster_settings") as any)
    .update({
      default_break_minutes: input.default_break_minutes,
      default_split_start_time: input.default_split_start_time,
      week_starts_on: input.week_starts_on,
      show_weekends: input.show_weekends,
    })
    .eq("id", 1);

  if (settingsErr) {
    return { ok: false as const, error: settingsErr.message };
  }

  // Save every row. Keep going on per-row failures and report which ones
  // failed so a single bad row doesn't block the others.
  const failures: string[] = [];
  for (const d of input.day_defaults) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("roster_day_defaults") as any)
      .update({ start_time: d.start_time, finish_time: d.finish_time })
      .eq("day_of_week", d.day_of_week);
    if (error) {
      failures.push(`${DAY_NAMES[d.day_of_week - 1]}: ${error.message}`);
    }
  }

  revalidatePath("/team/settings/roster");

  if (failures.length > 0) {
    return {
      ok: false as const,
      error: `Saved global settings but couldn't save ${failures.length} day(s): ${failures.join(" ")}`,
    };
  }
  return { ok: true as const };
}
