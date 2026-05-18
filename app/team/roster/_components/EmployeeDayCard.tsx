"use client";

import { useCallback, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical, X } from "lucide-react";
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
import { formatRange } from "@/lib/roster/dates";
import { RosterAssignmentBox } from "./RosterAssignmentBox";
import type { DragData, DropData } from "./dnd-types";

type Props = {
  card: EmployeeDayCardRow;
  employee: RosterEmployee | undefined;
  assignments: RosterAssignmentRow[];
  projectsById: Map<string, RosterProject>;
  otherItemsById: Map<string, RosterOtherItem>;
  onDeleteCard: (cardId: string) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onOpenCard: (card: EmployeeDayCardRow) => void;
  onOpenAssignment: (assignment: RosterAssignmentRow) => void;
};

export function EmployeeDayCard({
  card,
  employee,
  assignments,
  projectsById,
  otherItemsById,
  onDeleteCard,
  onDeleteAssignment,
  onOpenCard,
  onOpenAssignment,
}: Props) {
  const [hover, setHover] = useState(false);
  const isTemp = card.id.startsWith("temp-");

  const displayName =
    [employee?.display_first_name, employee?.last_name]
      .filter(Boolean)
      .join(" ") || "(unknown employee)";

  const dragData: DragData = {
    type: "employee-day-card",
    card_id: card.id,
    employee_id: card.employee_id,
    display_name: displayName,
  };

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `card:${card.id}`,
    data: dragData,
    disabled: isTemp,
  });

  const dropData: DropData = {
    type: "employee-day-card",
    card_id: card.id,
    roster_date: card.roster_date,
  };

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `card-drop:${card.id}`,
    data: dropData,
    disabled: isTemp,
  });

  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef],
  );

  const isSplit = assignments.some(
    (a) =>
      a.start_time !== card.start_time || a.finish_time !== card.finish_time,
  );
  const showCardTime = !isSplit && assignments.length <= 1;

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "rounded-md border bg-background overflow-hidden",
        isDragging && "opacity-40",
        isTemp && "opacity-60 animate-pulse",
        isOver
          ? "border-foreground/40 ring-1 ring-foreground/10"
          : card.status === "draft"
            ? "border-dashed border-gray-100"
            : card.status === "changed"
              ? "border-dashed border-amber-400"
              : "border-gray-300",
      )}
    >
      <div
        onClick={() => !isTemp && onOpenCard(card)}
        className={cn(
          "px-2.5 py-1.5 text-sm bg-neutral/40",
          !isTemp && "cursor-pointer",
        )}
      >
        <div className="flex items-center gap-2">
          <span
            {...listeners}
            {...attributes}
            className={cn(
              "shrink-0 text-gray-300",
              !isTemp && "cursor-grab active:cursor-grabbing hover:text-gray-500",
            )}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag handle"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          {card.status === "changed" && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
              aria-label="Changed since last publish"
              title="Changed since last publish"
            />
          )}
          <div className="flex-1 min-w-0 font-medium truncate">
            {displayName}
          </div>
          {hover && !isTemp && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteCard(card.id);
              }}
              className="text-gray-300 hover:text-foreground transition"
              aria-label="Delete card"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 pl-[22px]">
          {showCardTime
            ? formatRange(card.start_time, card.finish_time)
            : isSplit
              ? "Split day"
              : formatRange(card.start_time, card.finish_time)}
        </div>
      </div>

      <div className="p-1.5 space-y-1">
        {assignments.length === 0 ? (
          <div className="text-xs text-gray-500 italic px-1.5 py-2 text-center border border-dashed border-gray-100 rounded">
            Drop a job here
          </div>
        ) : (
          assignments.map((a) => (
            <RosterAssignmentBox
              key={a.id}
              assignment={a}
              project={a.project_id ? projectsById.get(a.project_id) : undefined}
              otherItem={
                a.other_item_id ? otherItemsById.get(a.other_item_id) : undefined
              }
              cardStart={card.start_time}
              cardFinish={card.finish_time}
              hideTime={assignments.length === 1 && !isSplit}
              onDelete={onDeleteAssignment}
              onOpen={onOpenAssignment}
            />
          ))
        )}
      </div>
    </div>
  );
}
