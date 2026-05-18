"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { StickyNote } from "lucide-react";
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
  formatRange,
  humanDate,
  todayISO,
} from "@/lib/roster/dates";
import { ReadOnlyViewHeader } from "../../_components/ReadOnlyViewHeader";

type Props = {
  date: string;
  cards: EmployeeDayCardRow[];
  assignments: RosterAssignmentRow[];
  employees: RosterEmployee[];
  projects: RosterProject[];
  otherItems: RosterOtherItem[];
};

export function DayView({
  date,
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
  const assignmentsByCard = new Map<string, RosterAssignmentRow[]>();
  for (const a of assignments) {
    const arr = assignmentsByCard.get(a.employee_day_card_id) ?? [];
    arr.push(a);
    assignmentsByCard.set(a.employee_day_card_id, arr);
  }

  function navDay(toISO: string) {
    router.push(`/team/roster/day?d=${toISO}`);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      <ReadOnlyViewHeader
        active="day"
        title="Day"
        subtitle={humanDate(date)}
        onPrev={() => navDay(addDaysISO(date, -1))}
        onNext={() => navDay(addDaysISO(date, 1))}
        onToday={() => navDay(todayISO())}
        prevLabel="Previous day"
        nextLabel="Next day"
      />

      <div className="flex-1 overflow-y-auto px-6 pb-12">
        <div className="max-w-3xl mx-auto space-y-4">
          {cards.length === 0 ? (
            <div className="text-center text-gray-500 italic text-sm border border-dashed border-gray-100 rounded-lg py-16">
              No one rostered for this day.
              <div className="mt-2">
                <Link
                  href={`/team/roster?week=${date}`}
                  className="text-foreground underline underline-offset-[3px] decoration-2 hover:no-underline text-sm"
                >
                  Open Week view to add
                </Link>
              </div>
            </div>
          ) : (
            cards.map((card) => {
              const employee = employeesById.get(card.employee_id);
              const employeeName =
                [employee?.display_first_name, employee?.last_name]
                  .filter(Boolean)
                  .join(" ") || "(unknown employee)";
              const cardAssignments = assignmentsByCard.get(card.id) ?? [];
              const isDraft = card.status === "draft";
              const isChanged = card.status === "changed";

              return (
                <Link
                  key={card.id}
                  href={`/team/roster?week=${date}`}
                  className={cn(
                    "block rounded-lg border bg-background px-5 py-4 no-underline text-foreground hover:bg-neutral/30 transition",
                    isDraft
                      ? "border-dashed border-gray-100"
                      : "border-gray-100",
                  )}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      {isChanged && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-amber-500"
                          aria-label="Changed since last publish"
                        />
                      )}
                      <h2 className="text-base font-medium">{employeeName}</h2>
                      {employee?.trade && (
                        <span className="text-xs text-gray-500">
                          {employee.trade}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatRange(card.start_time, card.finish_time)}
                    </span>
                  </div>

                  {card.card_notes && (
                    <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-3 pl-1">
                      <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{card.card_notes}</span>
                    </div>
                  )}

                  {cardAssignments.length === 0 ? (
                    <div className="text-xs text-gray-500 italic px-2 py-2 border border-dashed border-gray-100 rounded">
                      No job assigned.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {cardAssignments.map((a) => {
                        const project = a.project_id
                          ? projectsById.get(a.project_id)
                          : undefined;
                        const otherItem = a.other_item_id
                          ? otherItemsById.get(a.other_item_id)
                          : undefined;
                        const label =
                          otherItem?.label ??
                          project?.derived_label ??
                          project?.job_code ??
                          "(unknown)";
                        const colour =
                          otherItem?.colour ?? project?.colour ?? "#9c9c9c";

                        return (
                          <div
                            key={a.id}
                            className="flex items-stretch gap-2 rounded-sm border border-gray-100 overflow-hidden"
                          >
                            <div
                              className="w-1 shrink-0"
                              style={{ backgroundColor: colour }}
                            />
                            <div className="flex-1 min-w-0 px-2 py-1.5">
                              <div className="flex items-center justify-between gap-2 text-sm">
                                <span className="font-medium truncate">
                                  {label}
                                </span>
                                <span className="text-xs text-gray-500 shrink-0">
                                  {formatRange(a.start_time, a.finish_time)}
                                </span>
                              </div>
                              {a.area && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {a.area}
                                </div>
                              )}
                              {a.notes && (
                                <div className="flex items-start gap-1.5 text-xs text-gray-500 mt-1">
                                  <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span>{a.notes}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
