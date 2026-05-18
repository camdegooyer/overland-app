"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { logAuditBatch } from "@/lib/roster/audit";
import { todayISO, addDaysISO } from "@/lib/roster/dates";
import { composeShiftDigest } from "@/lib/notifications/shift-emails";
import { sendShiftDigest, logSkippedNotification } from "@/lib/notifications/send";
import type {
  RosterEmployee,
  RosterOtherItem,
  RosterProject,
} from "@/lib/roster/types";
import type {
  EmployeeDayCardRow,
  RosterAssignmentRow,
} from "@/lib/roster/queries";

const RangeInput = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  week_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type CardRow = {
  id: string;
  status: string;
  roster_date: string;
  employee_id: string;
};

type AssignmentRow = {
  id: string;
  status: string;
  employee_day_card_id: string;
};

/**
 * Mark every draft + changed card and assignment in the given date range
 * as published. Returns counts so the UI can toast the result.
 */
export async function publishUnpublishedInRange(
  raw: z.infer<typeof RangeInput>,
) {
  return await publishInner(raw, /* includeAlreadyPublished */ false);
}

/**
 * Mark every card and assignment in the range as published, regardless of
 * current status. Only meaningful once real notifications are wired up —
 * the intent is "re-notify everyone, even rows that haven't changed."
 */
export async function republishAllInRange(raw: z.infer<typeof RangeInput>) {
  return await publishInner(raw, /* includeAlreadyPublished */ true);
}

async function publishInner(
  raw: z.infer<typeof RangeInput>,
  includeAlreadyPublished: boolean,
) {
  await requireAdmin();
  const input = RangeInput.parse(raw);

  const supabase = await createClient();

  const cardStatusFilter = includeAlreadyPublished
    ? ["draft", "changed", "published"]
    : ["draft", "changed"];

  // Pull the cards in range that are eligible. We need their ids both to
  // update them and to find their child assignments. employee_id needed for
  // grouping notifications later.
  const { data: rawCards, error: cardsErr } = await supabase
    .from("employee_day_cards")
    .select("id, status, roster_date, employee_id")
    .gte("roster_date", input.week_start)
    .lte("roster_date", input.week_end);
  if (cardsErr) return { ok: false as const, error: cardsErr.message };

  const allCards = (rawCards ?? []) as CardRow[];
  const cardsToPublish = allCards.filter((c) =>
    cardStatusFilter.includes(c.status),
  );
  const allCardIds = allCards.map((c) => c.id);

  // Pull all assignments belonging to in-range cards. We always look at the
  // whole set so we can apply the same status filter to assignments.
  let assignmentsToPublish: AssignmentRow[] = [];
  if (allCardIds.length > 0) {
    const { data: rawAssignments, error: aErr } = await supabase
      .from("roster_assignments")
      .select("id, status, employee_day_card_id")
      .in("employee_day_card_id", allCardIds);
    if (aErr) return { ok: false as const, error: aErr.message };
    assignmentsToPublish = ((rawAssignments ?? []) as AssignmentRow[]).filter(
      (a) => cardStatusFilter.includes(a.status),
    );
  }

  if (cardsToPublish.length === 0 && assignmentsToPublish.length === 0) {
    return {
      ok: true as const,
      cardsPublished: 0,
      assignmentsPublished: 0,
      cardIds: [] as string[],
      assignmentIds: [] as string[],
      notificationsSent: 0,
      notificationsSkipped: 0,
      notificationsFailed: 0,
    };
  }

  // Update cards.
  if (cardsToPublish.length > 0) {
    const ids = cardsToPublish.map((c) => c.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("employee_day_cards") as any)
      .update({ status: "published" })
      .in("id", ids);
    if (error) return { ok: false as const, error: error.message };
  }

  // Update assignments.
  if (assignmentsToPublish.length > 0) {
    const ids = assignmentsToPublish.map((a) => a.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("roster_assignments") as any)
      .update({ status: "published" })
      .in("id", ids);
    if (error) return { ok: false as const, error: error.message };
  }

  // Batched audit log — one row per entity. Keep before/after compact since
  // a publish run can touch hundreds of rows.
  await logAuditBatch([
    ...cardsToPublish.map((c) => ({
      entity_type: "employee_day_card" as const,
      entity_id: c.id,
      action: "update" as const,
      before: { status: c.status },
      after: { status: "published" as const },
    })),
    ...assignmentsToPublish.map((a) => ({
      entity_type: "roster_assignment" as const,
      entity_id: a.id,
      action: "update" as const,
      before: { status: a.status },
      after: { status: "published" as const },
    })),
  ]);

  // Fire shift-digest emails for every employee whose cards/assignments were
  // part of this publish. Composing + sending happens via the send_email Edge
  // Function (Gmail API). Failures here never roll back the publish.
  const notifyResult = await notifyAffectedEmployees({
    cardsToPublish,
    assignmentsToPublish,
    cardsByCardId: new Map(allCards.map((c) => [c.id, c])),
  });

  revalidatePath("/team/roster");
  return {
    ok: true as const,
    cardsPublished: cardsToPublish.length,
    assignmentsPublished: assignmentsToPublish.length,
    cardIds: cardsToPublish.map((c) => c.id),
    assignmentIds: assignmentsToPublish.map((a) => a.id),
    notificationsSent: notifyResult.sent,
    notificationsSkipped: notifyResult.skipped,
    notificationsFailed: notifyResult.failed,
  };
}

// ----------------------------------------------------------------- notify ---

async function notifyAffectedEmployees(args: {
  cardsToPublish: CardRow[];
  assignmentsToPublish: AssignmentRow[];
  cardsByCardId: Map<string, CardRow>;
}): Promise<{ sent: number; skipped: number; failed: number }> {
  // Build per-employee impact: which cards/assignments of THIS publish belong
  // to them, and which were prior-status 'changed' (so we mark them).
  const employeeImpact = new Map<
    string,
    {
      publishedCardIds: Set<string>;
      publishedAssignmentIds: Set<string>;
      changedCardIds: Set<string>;
      changedAssignmentIds: Set<string>;
    }
  >();

  function impact(employeeId: string) {
    let v = employeeImpact.get(employeeId);
    if (!v) {
      v = {
        publishedCardIds: new Set(),
        publishedAssignmentIds: new Set(),
        changedCardIds: new Set(),
        changedAssignmentIds: new Set(),
      };
      employeeImpact.set(employeeId, v);
    }
    return v;
  }

  for (const c of args.cardsToPublish) {
    const i = impact(c.employee_id);
    i.publishedCardIds.add(c.id);
    if (c.status === "changed") i.changedCardIds.add(c.id);
  }
  for (const a of args.assignmentsToPublish) {
    const card = args.cardsByCardId.get(a.employee_day_card_id);
    if (!card) continue;
    const i = impact(card.employee_id);
    i.publishedAssignmentIds.add(a.id);
    if (a.status === "changed") i.changedAssignmentIds.add(a.id);
  }

  const affectedEmployeeIds = Array.from(employeeImpact.keys());
  if (affectedEmployeeIds.length === 0) {
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const supabase = await createClient();
  const todayDate = todayISO();
  const horizonDate = addDaysISO(todayDate, 7);

  // One pass to fetch everything the composer needs.
  const [
    { data: employeesData, error: empErr },
    { data: windowCardsData, error: cardsErr },
    { data: projectsData, error: projErr },
    { data: otherItemsData, error: otherErr },
  ] = await Promise.all([
    supabase
      .from("roster_employees")
      .select("*")
      .in("id", affectedEmployeeIds),
    supabase
      .from("employee_day_cards")
      .select(
        "id, employee_id, roster_date, start_time, finish_time, card_notes, status, sort_order",
      )
      .in("employee_id", affectedEmployeeIds)
      .gte("roster_date", todayDate)
      .lte("roster_date", horizonDate),
    supabase.from("roster_projects").select("*"),
    supabase.from("roster_other_items").select("*"),
  ]);

  if (empErr || cardsErr || projErr || otherErr) {
    console.error("[notify] data fetch failed:", {
      empErr,
      cardsErr,
      projErr,
      otherErr,
    });
    return { sent: 0, skipped: 0, failed: affectedEmployeeIds.length };
  }

  const employees = (employeesData ?? []) as RosterEmployee[];
  const windowCards = (windowCardsData ?? []) as EmployeeDayCardRow[];
  const projects = (projectsData ?? []) as RosterProject[];
  const otherItems = (otherItemsData ?? []) as RosterOtherItem[];

  // One assignments query for all window cards.
  let windowAssignments: RosterAssignmentRow[] = [];
  if (windowCards.length > 0) {
    const { data: aData, error: aErr } = await supabase
      .from("roster_assignments")
      .select(
        "id, employee_day_card_id, project_id, other_item_id, start_time, finish_time, area, notes, status, sort_order",
      )
      .in(
        "employee_day_card_id",
        windowCards.map((c) => c.id),
      );
    if (aErr) {
      console.error("[notify] assignments fetch failed:", aErr);
    } else {
      windowAssignments = (aData ?? []) as RosterAssignmentRow[];
    }
  }

  const employeesById = new Map(employees.map((e) => [e.id, e]));
  const cardsByEmployee = new Map<string, EmployeeDayCardRow[]>();
  for (const c of windowCards) {
    const arr = cardsByEmployee.get(c.employee_id) ?? [];
    arr.push(c);
    cardsByEmployee.set(c.employee_id, arr);
  }
  const assignmentsByCard = new Map<string, RosterAssignmentRow[]>();
  for (const a of windowAssignments) {
    const arr = assignmentsByCard.get(a.employee_day_card_id) ?? [];
    arr.push(a);
    assignmentsByCard.set(a.employee_day_card_id, arr);
  }

  // Per-employee dispatch in parallel.
  const results = await Promise.all(
    affectedEmployeeIds.map(async (employeeId) => {
      const employee = employeesById.get(employeeId);
      const impactData = employeeImpact.get(employeeId)!;

      if (!employee) {
        await logSkippedNotification({
          recipientEmployeeId: employeeId,
          reason: "Employee record not found in roster_employees view.",
          cardIds: Array.from(impactData.publishedCardIds),
          assignmentIds: Array.from(impactData.publishedAssignmentIds),
        });
        return "skipped" as const;
      }
      if (!employee.notify_enabled) {
        await logSkippedNotification({
          recipientEmployeeId: employeeId,
          reason: "notify_enabled is false.",
          cardIds: Array.from(impactData.publishedCardIds),
          assignmentIds: Array.from(impactData.publishedAssignmentIds),
        });
        return "skipped" as const;
      }
      if (!employee.email) {
        await logSkippedNotification({
          recipientEmployeeId: employeeId,
          reason: "No email address on contact row.",
          cardIds: Array.from(impactData.publishedCardIds),
          assignmentIds: Array.from(impactData.publishedAssignmentIds),
        });
        return "skipped" as const;
      }

      const employeeCards = cardsByEmployee.get(employeeId) ?? [];
      const employeeAssignments = employeeCards.flatMap(
        (c) => assignmentsByCard.get(c.id) ?? [],
      );

      const digest = composeShiftDigest({
        employee,
        publishedCardIds: impactData.publishedCardIds,
        publishedAssignmentIds: impactData.publishedAssignmentIds,
        changedCardIds: impactData.changedCardIds,
        changedAssignmentIds: impactData.changedAssignmentIds,
        cards: employeeCards,
        assignments: employeeAssignments,
        projects,
        otherItems,
      });

      if (!digest) {
        await logSkippedNotification({
          recipientEmployeeId: employeeId,
          reason: "No shifts in the next 8 days.",
          cardIds: Array.from(impactData.publishedCardIds),
          assignmentIds: Array.from(impactData.publishedAssignmentIds),
        });
        return "skipped" as const;
      }

      const send = await sendShiftDigest(digest, employeeId);
      return send.ok ? ("sent" as const) : ("failed" as const);
    }),
  );

  return {
    sent: results.filter((r) => r === "sent").length,
    skipped: results.filter((r) => r === "skipped").length,
    failed: results.filter((r) => r === "failed").length,
  };
}
