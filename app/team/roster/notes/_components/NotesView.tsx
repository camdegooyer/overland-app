"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { StickyNote } from "lucide-react";
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
  humanDate,
  longDate,
  todayISO,
} from "@/lib/roster/dates";
import { ReadOnlyViewHeader } from "../../_components/ReadOnlyViewHeader";

type Props = {
  weekStart: string;
  cards: EmployeeDayCardRow[];
  assignments: RosterAssignmentRow[];
  employees: RosterEmployee[];
  projects: RosterProject[];
  otherItems: RosterOtherItem[];
};

type NoteRow =
  | {
      kind: "card";
      id: string;
      date: string;
      employeeName: string;
      notes: string;
    }
  | {
      kind: "assignment";
      id: string;
      date: string;
      employeeName: string;
      jobLabel: string;
      colour: string;
      timeRange: string;
      notes: string;
    };

export function NotesView({
  weekStart,
  cards,
  assignments,
  employees,
  projects,
  otherItems,
}: Props) {
  const router = useRouter();

  const employeesById = new Map(employees.map((e) => [e.id, e]));
  const projectsById = new Map(projects.map((p) => [p.project_id, p]));
  const otherItemsById = new Map(otherItems.map((o) => [o.id, o]));
  const cardsById = new Map(cards.map((c) => [c.id, c]));

  const rows: NoteRow[] = [];

  for (const card of cards) {
    if (!card.card_notes) continue;
    const employee = employeesById.get(card.employee_id);
    const employeeName =
      [employee?.display_first_name, employee?.last_name]
        .filter(Boolean)
        .join(" ") || "(unknown employee)";
    rows.push({
      kind: "card",
      id: card.id,
      date: card.roster_date,
      employeeName,
      notes: card.card_notes,
    });
  }

  for (const a of assignments) {
    if (!a.notes) continue;
    const card = cardsById.get(a.employee_day_card_id);
    if (!card) continue;
    const employee = employeesById.get(card.employee_id);
    const employeeName =
      [employee?.display_first_name, employee?.last_name]
        .filter(Boolean)
        .join(" ") || "(unknown employee)";
    const project = a.project_id ? projectsById.get(a.project_id) : undefined;
    const otherItem = a.other_item_id
      ? otherItemsById.get(a.other_item_id)
      : undefined;
    rows.push({
      kind: "assignment",
      id: a.id,
      date: card.roster_date,
      employeeName,
      jobLabel:
        otherItem?.label ??
        project?.derived_label ??
        project?.job_code ??
        "(unknown)",
      colour: otherItem?.colour ?? project?.colour ?? "#9c9c9c",
      timeRange: formatRange(a.start_time, a.finish_time),
      notes: a.notes,
    });
  }

  // Sort by date asc, then employee name.
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.employeeName.localeCompare(b.employeeName);
  });

  function navWeek(toISO: string) {
    router.push(`/team/roster/notes?week=${toISO}`);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      <ReadOnlyViewHeader
        active="notes"
        title="Notes"
        subtitle={`Week of ${longDate(weekStart)}`}
        onPrev={() => navWeek(addDaysISO(weekStart, -7))}
        onNext={() => navWeek(addDaysISO(weekStart, 7))}
        onToday={() => navWeek(todayISO())}
        prevLabel="Previous week"
        nextLabel="Next week"
      />

      <div className="flex-1 overflow-y-auto px-6 pb-12">
        <div className="max-w-3xl mx-auto space-y-3">
          {rows.length === 0 ? (
            <div className="text-center text-gray-500 italic text-sm border border-dashed border-gray-100 rounded-lg py-16">
              No notes on this week&apos;s roster.
            </div>
          ) : (
            rows.map((row) => (
              <Link
                key={`${row.kind}:${row.id}`}
                href={`/team/roster?week=${row.date}`}
                className="block rounded-lg border border-gray-100 bg-background px-5 py-4 no-underline text-foreground hover:bg-neutral/30 transition"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{row.employeeName}</span>
                    {row.kind === "assignment" && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: row.colour }}
                        />
                        <span className="text-gray-500 truncate">
                          {row.jobLabel}
                        </span>
                        {row.timeRange && (
                          <span className="text-gray-300 text-xs ml-1">
                            {row.timeRange}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">
                    {humanDate(row.date)}
                  </span>
                </div>
                <div className="flex items-start gap-1.5 text-sm text-gray-500">
                  <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span className="whitespace-pre-wrap">{row.notes}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
