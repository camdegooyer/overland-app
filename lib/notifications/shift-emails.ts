import "server-only";
import { format, parseISO } from "date-fns";
import type {
  EmployeeDayCardRow,
  RosterAssignmentRow,
} from "@/lib/roster/queries";
import type {
  RosterEmployee,
  RosterOtherItem,
  RosterProject,
} from "@/lib/roster/types";
import {
  addDaysISO,
  formatRange,
  isoDayOfWeek,
  todayISO,
} from "@/lib/roster/dates";

export type ShiftEmailKind = "new_roster" | "roster_update";

export type ShiftDigest = {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: ShiftEmailKind;
  cardIds: string[];
  assignmentIds: string[];
};

type ComposeInput = {
  employee: RosterEmployee;
  publishedCardIds: Set<string>;     // cards from this publish (for this employee)
  publishedAssignmentIds: Set<string>;
  changedCardIds: Set<string>;       // subset that were 'changed' before publish (vs 'draft')
  changedAssignmentIds: Set<string>;
  cards: EmployeeDayCardRow[];       // ALL of this employee's cards in today+7
  assignments: RosterAssignmentRow[];// ALL assignments for those cards
  projects: RosterProject[];
  otherItems: RosterOtherItem[];
};

/**
 * Builds a single digest email for one employee covering today + next 7 days.
 * Returns null if the employee has nothing to show (no shifts in range) — the
 * caller should skip sending in that case.
 *
 * Subject + kind reflect whether this publish included any "changed" rows for
 * this employee:
 *   - any changed → "roster_update" with "Your roster updated — <date>"
 *   - else        → "new_roster"    with "Your Overland roster — <range>"
 */
export function composeShiftDigest(input: ComposeInput): ShiftDigest | null {
  const {
    employee,
    publishedCardIds,
    publishedAssignmentIds,
    changedCardIds,
    changedAssignmentIds,
    cards,
    assignments,
    projects,
    otherItems,
  } = input;

  if (!employee.email) return null;

  const todayDate = todayISO();
  const horizonDate = addDaysISO(todayDate, 7);

  // Filter to the 8-day window and exclude weekends (Sat=6, Sun=7).
  const isWeekend = (dateISO: string) => {
    const dow = isoDayOfWeek(dateISO);
    return dow === 6 || dow === 7;
  };
  const windowCards = cards
    .filter(
      (c) =>
        c.roster_date >= todayDate &&
        c.roster_date <= horizonDate &&
        !isWeekend(c.roster_date),
    )
    .sort((a, b) => a.roster_date.localeCompare(b.roster_date));

  if (windowCards.length === 0) return null;

  const projectsById = new Map(projects.map((p) => [p.project_id, p]));
  const otherItemsById = new Map(otherItems.map((o) => [o.id, o]));
  const assignmentsByCard = new Map<string, RosterAssignmentRow[]>();
  for (const a of assignments) {
    const arr = assignmentsByCard.get(a.employee_day_card_id) ?? [];
    arr.push(a);
    assignmentsByCard.set(a.employee_day_card_id, arr);
  }

  // Determine email kind
  const hasChanges =
    windowCards.some((c) => changedCardIds.has(c.id)) ||
    windowCards.some((c) =>
      (assignmentsByCard.get(c.id) ?? []).some((a) =>
        changedAssignmentIds.has(a.id),
      ),
    );
  const kind: ShiftEmailKind = hasChanges ? "roster_update" : "new_roster";

  const firstName = employee.display_first_name ?? "there";
  const firstWindowDate = windowCards[0].roster_date;
  const lastWindowDate = windowCards[windowCards.length - 1].roster_date;

  const subject =
    kind === "roster_update"
      ? `Your roster updated - ${formatShortDate(firstWindowDate)}`
      : `Your Overland roster - ${formatShortDate(firstWindowDate)} to ${formatShortDate(lastWindowDate)}`;

  // Build day-by-day rows for the next 8 days (today + 7), weekdays only.
  const dayRows: DayRow[] = [];
  let cursor = todayDate;
  while (cursor <= horizonDate) {
    if (isWeekend(cursor)) {
      cursor = addDaysISO(cursor, 1);
      continue;
    }
    const card = windowCards.find((c) => c.roster_date === cursor);
    if (!card) {
      dayRows.push({ dateISO: cursor, kind: "off" });
    } else {
      const cardAssignments = assignmentsByCard.get(card.id) ?? [];
      const wasChanged =
        changedCardIds.has(card.id) ||
        cardAssignments.some((a) => changedAssignmentIds.has(a.id));
      const lines: AssignmentLine[] = cardAssignments.map((a) => {
        const project = a.project_id ? projectsById.get(a.project_id) : undefined;
        const otherItem = a.other_item_id
          ? otherItemsById.get(a.other_item_id)
          : undefined;
        return {
          label:
            otherItem?.label ??
            project?.derived_label ??
            project?.job_code ??
            "(unknown)",
          time: formatRange(a.start_time, a.finish_time),
          area: a.area,
          notes: a.notes,
        };
      });
      dayRows.push({
        dateISO: cursor,
        kind: "on",
        cardTime: formatRange(card.start_time, card.finish_time),
        cardNotes: card.card_notes,
        assignments: lines,
        wasChanged,
      });
    }
    cursor = addDaysISO(cursor, 1);
  }

  const text = renderText({
    firstName,
    kind,
    dayRows,
  });
  const html = renderHtml({
    firstName,
    kind,
    dayRows,
  });

  return {
    to: employee.email,
    subject,
    html,
    text,
    kind,
    cardIds: windowCards
      .filter((c) => publishedCardIds.has(c.id))
      .map((c) => c.id),
    assignmentIds: windowCards
      .flatMap((c) => assignmentsByCard.get(c.id) ?? [])
      .filter((a) => publishedAssignmentIds.has(a.id))
      .map((a) => a.id),
  };
}

// ---------------------------------------------------------- rendering -------

type AssignmentLine = {
  label: string;
  time: string;
  area: string | null;
  notes: string | null;
};

type DayRow =
  | { dateISO: string; kind: "off" }
  | {
      dateISO: string;
      kind: "on";
      cardTime: string;
      cardNotes: string | null;
      assignments: AssignmentLine[];
      wasChanged: boolean;
    };

function formatShortDate(dateISO: string): string {
  return format(parseISO(dateISO), "EEE d MMM");
}

function formatFullDate(dateISO: string): string {
  return format(parseISO(dateISO), "EEEE do MMMM");
}

function renderText({
  firstName,
  kind,
  dayRows,
}: {
  firstName: string;
  kind: ShiftEmailKind;
  dayRows: DayRow[];
}): string {
  const lines: string[] = [];
  lines.push(`Hi ${firstName},`);
  lines.push("");
  lines.push(
    kind === "roster_update"
      ? "There are some updates to your roster. Your shifts for the next 8 days:"
      : "Here are your shifts for the next 8 days:",
  );
  lines.push("");

  for (const row of dayRows) {
    if (row.kind === "off") {
      lines.push(`${formatFullDate(row.dateISO)}: No shift`);
    } else {
      const tag = row.wasChanged ? " [Changed]" : "";
      lines.push(`${formatFullDate(row.dateISO)} - ${row.cardTime}${tag}`);
      if (row.cardNotes) {
        lines.push(`  Note: ${row.cardNotes}`);
      }
      if (row.assignments.length === 0) {
        lines.push(`  (no job assigned)`);
      } else {
        for (const a of row.assignments) {
          let line = `  - ${a.label}`;
          if (a.time && a.time !== row.cardTime) line += ` (${a.time})`;
          lines.push(line);
          if (a.area) lines.push(`      Area: ${a.area}`);
          if (a.notes) lines.push(`      Notes: ${a.notes}`);
        }
      }
    }
    lines.push("");
  }

  lines.push("- Overland Builders");
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml({
  firstName,
  kind,
  dayRows,
}: {
  firstName: string;
  kind: ShiftEmailKind;
  dayRows: DayRow[];
}): string {
  const intro =
    kind === "roster_update"
      ? "There are some updates to your roster. Your shifts for the next 8 days:"
      : "Here are your shifts for the next 8 days:";

  const dayBlocks = dayRows.map((row) => {
    if (row.kind === "off") {
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:14px;">
            <strong>${escapeHtml(formatFullDate(row.dateISO))}</strong><br>
            <span style="color:#aaa;">No shift</span>
          </td>
        </tr>`;
    }
    const tag = row.wasChanged
      ? `<span style="display:inline-block;margin-left:8px;padding:1px 6px;border-radius:3px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:600;">CHANGED</span>`
      : "";
    const noteRow = row.cardNotes
      ? `<div style="font-size:13px;color:#666;margin-top:4px;font-style:italic;">${escapeHtml(row.cardNotes)}</div>`
      : "";
    const assignmentRows =
      row.assignments.length === 0
        ? `<div style="font-size:13px;color:#aaa;margin-top:6px;">(no job assigned)</div>`
        : row.assignments
            .map((a) => {
              const timePart =
                a.time && a.time !== row.cardTime
                  ? ` <span style="color:#888;font-size:12px;">(${escapeHtml(a.time)})</span>`
                  : "";
              const area = a.area
                ? `<div style="font-size:12px;color:#666;margin-left:14px;">Area: ${escapeHtml(a.area)}</div>`
                : "";
              const notes = a.notes
                ? `<div style="font-size:12px;color:#666;margin-left:14px;">Notes: ${escapeHtml(a.notes)}</div>`
                : "";
              return `
                <div style="margin-top:6px;">
                  <span style="font-size:14px;">• ${escapeHtml(a.label)}${timePart}</span>
                  ${area}
                  ${notes}
                </div>`;
            })
            .join("");
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;">
          <div style="font-size:14px;">
            <strong>${escapeHtml(formatFullDate(row.dateISO))}</strong>
            <span style="color:#666;margin-left:8px;">${escapeHtml(row.cardTime)}</span>
            ${tag}
          </div>
          ${noteRow}
          ${assignmentRows}
        </td>
      </tr>`;
  });

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#222;max-width:600px;margin:0 auto;padding:24px;">
  <p style="font-size:15px;">Hi ${escapeHtml(firstName)},</p>
  <p style="font-size:15px;">${escapeHtml(intro)}</p>
  <table style="width:100%;border-collapse:collapse;margin-top:16px;">
    ${dayBlocks.join("")}
  </table>
  <p style="font-size:13px;color:#888;margin-top:32px;">- Overland Builders</p>
</body>
</html>`;
}
