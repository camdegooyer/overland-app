import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  RosterDayDefault,
  RosterEmployee,
  RosterOtherItem,
  RosterProject,
  RosterSettings,
} from "./types";

/**
 * Roster-side data fetchers. All run server-side via the user-scoped client
 * so RLS applies. Sensitive base tables (employees, projects) are accessed
 * via their roster_* views which expose only safe fields.
 */

export async function getRosterEmployees(): Promise<RosterEmployee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roster_employees")
    .select("*")
    .order("is_active", { ascending: false })
    .order("roster_sort_order", { ascending: true })
    .order("display_first_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as RosterEmployee[];
}

/** Subset shown in the roster side panel — only ticked + currently employed. */
export async function getRosterableEmployees(): Promise<RosterEmployee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roster_employees")
    .select("*")
    .eq("is_roster_employee", true)
    .eq("is_active", true)
    .order("roster_sort_order")
    .order("display_first_name");

  if (error) throw error;
  return (data ?? []) as RosterEmployee[];
}

export async function getRosterProjects(opts?: {
  visibleOnly?: boolean;
}): Promise<RosterProject[]> {
  const supabase = await createClient();
  let q = supabase.from("roster_projects").select("*");
  if (opts?.visibleOnly) q = q.eq("show_in_side_panel", true);
  q = q.order("sort_order").order("job_code");

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as RosterProject[];
}

export async function getRosterOtherItems(opts?: {
  activeOnly?: boolean;
}): Promise<RosterOtherItem[]> {
  const supabase = await createClient();
  let q = supabase.from("roster_other_items").select("*");
  if (opts?.activeOnly) q = q.eq("is_active", true);
  q = q.order("sort_order").order("label");

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as RosterOtherItem[];
}

export async function getRosterSettings(): Promise<RosterSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roster_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) throw error;
  return data as RosterSettings;
}

export async function getRosterDayDefaults(): Promise<RosterDayDefault[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roster_day_defaults")
    .select("day_of_week, start_time, finish_time")
    .order("day_of_week");
  if (error) throw error;
  return (data ?? []) as RosterDayDefault[];
}

// ----------------------------------------------------------------- week data --

export type EmployeeDayCardRow = {
  id: string;
  employee_id: string;
  roster_date: string;
  start_time: string;
  finish_time: string;
  card_notes: string | null;
  status: string;
  sort_order: number;
};

export type RosterAssignmentRow = {
  id: string;
  employee_day_card_id: string;
  project_id: string | null;
  other_item_id: string | null;
  start_time: string;
  finish_time: string;
  area: string | null;
  notes: string | null;
  status: string;
  sort_order: number;
};

export type WeekRosterData = {
  cards: EmployeeDayCardRow[];
  assignments: RosterAssignmentRow[];
};

/**
 * Fetches all cards (and their assignments) with roster_date in [startISO, endISO]
 * inclusive. Returns flat arrays; the client component groups them.
 */
export async function getWeekRosterData(
  startISO: string,
  endISO: string,
): Promise<WeekRosterData> {
  const supabase = await createClient();

  const { data: cards, error: cardsErr } = await supabase
    .from("employee_day_cards")
    .select(
      "id, employee_id, roster_date, start_time, finish_time, card_notes, status, sort_order",
    )
    .gte("roster_date", startISO)
    .lte("roster_date", endISO)
    .order("sort_order");

  if (cardsErr) throw cardsErr;
  const cardRows = (cards ?? []) as EmployeeDayCardRow[];

  if (cardRows.length === 0) {
    return { cards: [], assignments: [] };
  }

  const cardIds = cardRows.map((c) => c.id);
  const { data: assignments, error: aErr } = await supabase
    .from("roster_assignments")
    .select(
      "id, employee_day_card_id, project_id, other_item_id, start_time, finish_time, area, notes, status, sort_order",
    )
    .in("employee_day_card_id", cardIds)
    .order("sort_order");

  if (aErr) throw aErr;

  return {
    cards: cardRows,
    assignments: (assignments ?? []) as RosterAssignmentRow[],
  };
}
