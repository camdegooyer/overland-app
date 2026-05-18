"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
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
  isTodayISO,
  longDate,
  shortDayLabel,
  todayISO,
} from "@/lib/roster/dates";
import { ReadOnlyViewHeader } from "../../_components/ReadOnlyViewHeader";

type Props = {
  weekStart: string;
  weekDates: string[];
  cards: EmployeeDayCardRow[];
  assignments: RosterAssignmentRow[];
  employees: RosterEmployee[];
  projects: RosterProject[];
  otherItems: RosterOtherItem[];
};

type Group = {
  key: string; // project_id or other_item_id
  kind: "project" | "other";
  label: string;
  colour: string;
  sortOrder: number;
};

export function ByJobView({
  weekStart,
  weekDates,
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

  // Group: groupKey -> dateISO -> employee display names.
  const byGroupByDate = new Map<string, Map<string, string[]>>();
  const groupMeta = new Map<string, Group>();

  for (const a of assignments) {
    const card = cardsById.get(a.employee_day_card_id);
    if (!card) continue;
    const employee = employeesById.get(card.employee_id);
    const employeeName =
      [employee?.display_first_name, employee?.last_name]
        .filter(Boolean)
        .join(" ") || "(?)";

    let key: string;
    let meta: Group;
    if (a.project_id) {
      const p = projectsById.get(a.project_id);
      key = `project:${a.project_id}`;
      meta = {
        key,
        kind: "project",
        label: p?.derived_label ?? p?.job_code ?? "(unknown project)",
        colour: p?.colour ?? "#9c9c9c",
        sortOrder: p?.sort_order ?? 0,
      };
    } else if (a.other_item_id) {
      const o = otherItemsById.get(a.other_item_id);
      key = `other:${a.other_item_id}`;
      meta = {
        key,
        kind: "other",
        label: o?.label ?? "(unknown item)",
        colour: o?.colour ?? "#9c9c9c",
        sortOrder: 10000 + (o?.sort_order ?? 0),
      };
    } else {
      continue;
    }
    groupMeta.set(key, meta);

    let byDate = byGroupByDate.get(key);
    if (!byDate) {
      byDate = new Map();
      byGroupByDate.set(key, byDate);
    }
    const list = byDate.get(card.roster_date) ?? [];
    list.push(employeeName);
    byDate.set(card.roster_date, list);
  }

  const groups = Array.from(groupMeta.values()).sort((a, b) => {
    // Projects first, then other items; within each, by sort_order then label.
    if (a.kind !== b.kind) return a.kind === "project" ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label);
  });

  function navWeek(toISO: string) {
    router.push(`/team/roster/by-job?week=${toISO}`);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      <ReadOnlyViewHeader
        active="by-job"
        title="By Job"
        subtitle={`Week of ${longDate(weekStart)}`}
        onPrev={() => navWeek(addDaysISO(weekStart, -7))}
        onNext={() => navWeek(addDaysISO(weekStart, 7))}
        onToday={() => navWeek(todayISO())}
        prevLabel="Previous week"
        nextLabel="Next week"
      />

      <div className="flex-1 overflow-auto px-6 pb-12">
        {groups.length === 0 ? (
          <div className="max-w-3xl mx-auto text-center text-gray-500 italic text-sm border border-dashed border-gray-100 rounded-lg py-16">
            No jobs rostered this week.
          </div>
        ) : (
          <div className="min-w-fit">
            {/* Header row */}
            <div className="flex gap-3 mb-3 sticky top-0 bg-background pt-2 pb-1 z-10">
              <div className="w-56 shrink-0" />
              {weekDates.map((date) => (
                <div
                  key={date}
                  className={cn(
                    "min-w-[160px] flex-1 text-sm font-medium px-3",
                    isTodayISO(date) && "underline underline-offset-4",
                  )}
                >
                  {shortDayLabel(date)}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {groups.map((g) => {
                const byDate = byGroupByDate.get(g.key);
                return (
                  <Link
                    key={g.key}
                    href={`/team/roster?week=${weekStart}`}
                    className="flex gap-3 items-stretch no-underline text-foreground rounded-lg border border-gray-100 bg-background hover:bg-neutral/30 transition overflow-hidden"
                  >
                    <div
                      className="w-1 shrink-0"
                      style={{ backgroundColor: g.colour }}
                    />
                    <div className="w-56 shrink-0 px-3 py-3 border-r border-gray-100">
                      <div className="font-medium text-sm truncate">
                        {g.label}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">
                        {g.kind === "project" ? "Job" : "Other"}
                      </div>
                    </div>
                    {weekDates.map((date) => {
                      const names = byDate?.get(date) ?? [];
                      return (
                        <div
                          key={date}
                          className="min-w-[160px] flex-1 px-3 py-3 text-xs text-gray-500"
                        >
                          {names.length === 0 ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {names.map((n, i) => (
                                <li key={i} className="text-foreground">
                                  {n}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
