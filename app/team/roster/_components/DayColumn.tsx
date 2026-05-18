"use client";

import { useDroppable } from "@dnd-kit/core";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortDayLabel, isTodayISO } from "@/lib/roster/dates";
import type {
  EmployeeDayCardRow,
  RosterAssignmentRow,
} from "@/lib/roster/queries";
import type {
  RosterEmployee,
  RosterOtherItem,
  RosterProject,
} from "@/lib/roster/types";
import { EmployeeDayCard } from "./EmployeeDayCard";
import type { DropData } from "./dnd-types";

type Props = {
  date: string;
  cards: EmployeeDayCardRow[];
  assignmentsByCard: Map<string, RosterAssignmentRow[]>;
  employeesById: Map<string, RosterEmployee>;
  projectsById: Map<string, RosterProject>;
  otherItemsById: Map<string, RosterOtherItem>;
  onDeleteCard: (cardId: string) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onAddAll: (date: string) => void;
  onOpenCard: (card: EmployeeDayCardRow) => void;
  onOpenAssignment: (assignment: RosterAssignmentRow) => void;
};

export function DayColumn({
  date,
  cards,
  assignmentsByCard,
  employeesById,
  projectsById,
  otherItemsById,
  onDeleteCard,
  onDeleteAssignment,
  onAddAll,
  onOpenCard,
  onOpenAssignment,
}: Props) {
  const data: DropData = { type: "day-column", date };

  const { setNodeRef, isOver } = useDroppable({
    id: `day:${date}`,
    data,
  });

  const today = isTodayISO(date);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-[220px] flex-1 rounded-lg border bg-background transition",
        isOver
          ? "border-foreground/40 ring-1 ring-foreground/10 bg-gray-50/40"
          : "border-gray-100",
      )}
    >
      <div
        className={cn(
          "px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2",
        )}
      >
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
        <button
          type="button"
          onClick={() => onAddAll(date)}
          className="text-xs text-gray-500 hover:text-foreground transition flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-neutral"
          title="Add all rosterable employees to this day"
        >
          <UserPlus className="h-3 w-3" />
          Add all
        </button>
      </div>

      <div className="p-2 space-y-2 flex-1 min-h-[120px]">
        {cards.length === 0 ? (
          <div className="text-xs text-gray-500 italic text-center py-6 px-2 border border-dashed border-gray-100 rounded">
            Drop an employee here
          </div>
        ) : (
          cards.map((c) => (
            <EmployeeDayCard
              key={c.id}
              card={c}
              employee={employeesById.get(c.employee_id)}
              assignments={assignmentsByCard.get(c.id) ?? []}
              projectsById={projectsById}
              otherItemsById={otherItemsById}
              onDeleteCard={onDeleteCard}
              onDeleteAssignment={onDeleteAssignment}
              onOpenCard={onOpenCard}
              onOpenAssignment={onOpenAssignment}
            />
          ))
        )}
      </div>
    </div>
  );
}
