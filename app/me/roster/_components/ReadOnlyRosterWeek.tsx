"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  isTodayISO,
  longDate,
  shortDayLabel,
  todayISO,
} from "@/lib/roster/dates";

type Props = {
  weekStart: string;
  weekDates: string[];
  cards: EmployeeDayCardRow[];
  assignments: RosterAssignmentRow[];
  employees: RosterEmployee[];
  projects: RosterProject[];
  otherItems: RosterOtherItem[];
};

export function ReadOnlyRosterWeek({
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

  const cardsByDate = new Map<string, EmployeeDayCardRow[]>();
  for (const c of cards) {
    const arr = cardsByDate.get(c.roster_date) ?? [];
    arr.push(c);
    cardsByDate.set(c.roster_date, arr);
  }
  const assignmentsByCard = new Map<string, RosterAssignmentRow[]>();
  for (const a of assignments) {
    const arr = assignmentsByCard.get(a.employee_day_card_id) ?? [];
    arr.push(a);
    assignmentsByCard.set(a.employee_day_card_id, arr);
  }

  function navWeek(toISO: string) {
    router.push(`/me/roster?week=${toISO}`);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      <div className="px-6 pt-8 pb-4 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-medium">Roster</h1>
            <p className="text-base text-gray-500 mt-1">
              Week of {longDate(weekStart)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navWeek(addDaysISO(weekStart, -7))}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navWeek(todayISO())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navWeek(addDaysISO(weekStart, 7))}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-x-auto px-6 pb-6">
        <div className="flex gap-3 min-w-fit">
          {weekDates.map((date) => {
            const dayCards = cardsByDate.get(date) ?? [];
            const today = isTodayISO(date);
            return (
              <div
                key={date}
                className="flex flex-col min-w-[220px] flex-1 rounded-lg border border-gray-100 bg-background"
              >
                <div className="px-3 py-2 border-b border-gray-100">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <span className={cn(today && "underline underline-offset-4")}>
                      {shortDayLabel(date)}
                    </span>
                    {today && (
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">
                        Today
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2 space-y-2 flex-1 min-h-[120px]">
                  {dayCards.length === 0 ? (
                    <div className="text-xs text-gray-500 italic text-center py-6 px-2 border border-dashed border-gray-100 rounded">
                      No one rostered.
                    </div>
                  ) : (
                    dayCards.map((card) => {
                      const employee = employeesById.get(card.employee_id);
                      const name =
                        [employee?.display_first_name, employee?.last_name]
                          .filter(Boolean)
                          .join(" ") || "(unknown)";
                      const cardAssignments =
                        assignmentsByCard.get(card.id) ?? [];
                      return (
                        <div
                          key={card.id}
                          className="rounded-md border border-gray-300 bg-background overflow-hidden"
                        >
                          <div className="px-2.5 py-1.5 bg-neutral/40">
                            <div className="font-medium text-sm truncate">
                              {name}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {formatRange(card.start_time, card.finish_time)}
                            </div>
                          </div>
                          {card.card_notes && (
                            <div className="px-2.5 py-1 text-xs text-gray-500 flex items-start gap-1.5 border-b border-gray-100">
                              <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                              <span>{card.card_notes}</span>
                            </div>
                          )}
                          <div className="p-1.5 space-y-1">
                            {cardAssignments.length === 0 ? (
                              <div className="text-xs text-gray-500 italic px-1.5 py-1 text-center">
                                No job
                              </div>
                            ) : (
                              cardAssignments.map((a) => {
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
                                  otherItem?.colour ??
                                  project?.colour ??
                                  "#9c9c9c";
                                const sameAsCard =
                                  a.start_time === card.start_time &&
                                  a.finish_time === card.finish_time;
                                return (
                                  <div
                                    key={a.id}
                                    className="flex items-stretch gap-2 rounded-sm border border-gray-100 overflow-hidden"
                                  >
                                    <div
                                      className="w-1 shrink-0"
                                      style={{ backgroundColor: colour }}
                                    />
                                    <div className="flex-1 min-w-0 px-1.5 py-1 text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-medium truncate flex-1">
                                          {label}
                                        </span>
                                        {a.notes && (
                                          <StickyNote
                                            className="h-3 w-3 text-gray-500 shrink-0"
                                            aria-label="Has notes"
                                          />
                                        )}
                                      </div>
                                      {!sameAsCard && (
                                        <div className="text-gray-500 mt-0.5">
                                          {formatRange(
                                            a.start_time,
                                            a.finish_time,
                                          )}
                                        </div>
                                      )}
                                      {a.notes && (
                                        <div className="text-gray-500 mt-1">
                                          {a.notes}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
