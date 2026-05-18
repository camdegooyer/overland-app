"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type {
  EmployeeDayCardRow,
  RosterAssignmentRow,
} from "@/lib/roster/queries";
import type {
  RosterOtherItem,
  RosterProject,
} from "@/lib/roster/types";
import {
  addMonthsISO,
  isTodayISO,
  monthLabel,
  todayISO,
} from "@/lib/roster/dates";
import { ReadOnlyViewHeader } from "../../_components/ReadOnlyViewHeader";

type GridCell = { dateISO: string; isCurrentMonth: boolean };

type Props = {
  anchor: string;
  gridCells: GridCell[];
  weekdayLabels: string[];
  cards: EmployeeDayCardRow[];
  assignments: RosterAssignmentRow[];
  projects: RosterProject[];
  otherItems: RosterOtherItem[];
};

export function MonthView({
  anchor,
  gridCells,
  weekdayLabels,
  cards,
  assignments,
  projects,
  otherItems,
}: Props) {
  const router = useRouter();

  const projectsById = new Map(projects.map((p) => [p.project_id, p]));
  const otherItemsById = new Map(otherItems.map((o) => [o.id, o]));
  const cardsById = new Map(cards.map((c) => [c.id, c]));

  // Date -> { employees: count, labels: top job/other labels }
  const cellsByDate = new Map<
    string,
    { employees: Set<string>; labelCounts: Map<string, number> }
  >();
  for (const c of cards) {
    let bucket = cellsByDate.get(c.roster_date);
    if (!bucket) {
      bucket = { employees: new Set(), labelCounts: new Map() };
      cellsByDate.set(c.roster_date, bucket);
    }
    bucket.employees.add(c.employee_id);
  }
  for (const a of assignments) {
    const card = cardsById.get(a.employee_day_card_id);
    if (!card) continue;
    const bucket = cellsByDate.get(card.roster_date);
    if (!bucket) continue;
    let label: string;
    if (a.project_id) {
      const p = projectsById.get(a.project_id);
      label = p?.derived_label ?? p?.job_code ?? "(project)";
    } else if (a.other_item_id) {
      const o = otherItemsById.get(a.other_item_id);
      label = o?.label ?? "(other)";
    } else {
      continue;
    }
    bucket.labelCounts.set(label, (bucket.labelCounts.get(label) ?? 0) + 1);
  }

  function navMonth(toISO: string) {
    router.push(`/team/roster/month?m=${toISO}`);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      <ReadOnlyViewHeader
        active="month"
        title="Month"
        subtitle={monthLabel(anchor)}
        onPrev={() => navMonth(addMonthsISO(anchor, -1))}
        onNext={() => navMonth(addMonthsISO(anchor, 1))}
        onToday={() => navMonth(todayISO())}
        prevLabel="Previous month"
        nextLabel="Next month"
      />

      <div className="flex-1 overflow-y-auto px-6 pb-12">
        <div className="max-w-6xl mx-auto">
          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 mb-1 text-xs uppercase tracking-wider text-gray-500">
            {weekdayLabels.map((d) => (
              <div key={d} className="px-2 py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 auto-rows-fr">
            {gridCells.map(({ dateISO, isCurrentMonth }) => {
              const bucket = cellsByDate.get(dateISO);
              const employeeCount = bucket?.employees.size ?? 0;
              const topLabels = bucket
                ? Array.from(bucket.labelCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([label]) => label)
                : [];
              const today = isTodayISO(dateISO);

              return (
                <Link
                  key={dateISO}
                  href={`/team/roster?week=${dateISO}`}
                  className={cn(
                    "block min-h-[110px] rounded-md border p-2 no-underline text-foreground hover:bg-neutral/40 transition",
                    isCurrentMonth
                      ? "bg-background border-gray-100"
                      : "bg-neutral/30 border-gray-100 text-gray-300",
                    today && "ring-1 ring-foreground/30",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "text-sm",
                        isCurrentMonth ? "font-medium" : "text-gray-300",
                        today && "underline underline-offset-4",
                      )}
                    >
                      {format(parseISO(dateISO), "do")}
                    </span>
                    {employeeCount > 0 && (
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">
                        {employeeCount}{" "}
                        {employeeCount === 1 ? "person" : "people"}
                      </span>
                    )}
                  </div>
                  {topLabels.length > 0 && (
                    <ul className="space-y-0.5 text-[11px] text-gray-500">
                      {topLabels.map((l) => (
                        <li key={l} className="truncate">
                          {l}
                        </li>
                      ))}
                      {bucket && bucket.labelCounts.size > 3 && (
                        <li className="text-gray-300">
                          +{bucket.labelCounts.size - 3} more
                        </li>
                      )}
                    </ul>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
