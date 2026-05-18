"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, StickyNote, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RosterAssignmentRow } from "@/lib/roster/queries";
import type { RosterOtherItem, RosterProject } from "@/lib/roster/types";
import { formatRange } from "@/lib/roster/dates";
import type { DragData } from "./dnd-types";

type Props = {
  assignment: RosterAssignmentRow;
  project: RosterProject | undefined;
  otherItem: RosterOtherItem | undefined;
  cardStart: string;
  cardFinish: string;
  hideTime?: boolean;
  onDelete: (assignmentId: string) => void;
  onOpen: (assignment: RosterAssignmentRow) => void;
};

export function RosterAssignmentBox({
  assignment,
  project,
  otherItem,
  cardStart,
  cardFinish,
  hideTime,
  onDelete,
  onOpen,
}: Props) {
  const [hover, setHover] = useState(false);
  const isTemp = assignment.id.startsWith("temp-");

  const colour =
    otherItem?.colour ?? project?.colour ?? "#9c9c9c";
  const label =
    otherItem?.label ??
    project?.derived_label ??
    project?.job_code ??
    "(unknown)";

  const sameAsCard =
    assignment.start_time === cardStart &&
    assignment.finish_time === cardFinish;

  const data: DragData = {
    type: "roster-assignment",
    assignment_id: assignment.id,
    project_id: assignment.project_id,
    other_item_id: assignment.other_item_id,
    employee_day_card_id: assignment.employee_day_card_id,
    display_name: label,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `assignment:${assignment.id}`,
    data,
    disabled: isTemp,
  });

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "group flex items-stretch gap-2 rounded-sm bg-background pr-1.5 py-1 text-xs overflow-hidden border",
        assignment.status === "draft"
          ? "border-dashed border-gray-100"
          : assignment.status === "changed"
            ? "border-dashed border-amber-400"
            : "border-gray-300",
        isDragging && "opacity-40",
        isTemp && "opacity-60 animate-pulse",
      )}
    >
      <div className="w-1 shrink-0" style={{ backgroundColor: colour }} />
      <span
        {...listeners}
        {...attributes}
        className={cn(
          "shrink-0 self-center text-gray-300",
          !isTemp && "cursor-grab active:cursor-grabbing hover:text-gray-500",
        )}
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag handle"
      >
        <GripVertical className="h-3 w-3" />
      </span>
      <div
        onClick={() => !isTemp && onOpen(assignment)}
        className={cn(
          "flex-1 min-w-0",
          !isTemp && "cursor-pointer",
        )}
      >
        <div className="flex items-center gap-1.5">
          {assignment.status === "changed" && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
              aria-label="Changed since last publish"
              title="Changed since last publish"
            />
          )}
          <span className="font-medium truncate flex-1">{label}</span>
          {assignment.notes && (
            <StickyNote
              className="h-3 w-3 text-gray-500 shrink-0"
              aria-label="Has notes"
            />
          )}
        </div>
        {!hideTime && !sameAsCard && (
          <div className="text-gray-500 mt-0.5 pl-0">
            {formatRange(assignment.start_time, assignment.finish_time)}
          </div>
        )}
      </div>
      {hover && !isTemp && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(assignment.id);
          }}
          className="text-gray-300 hover:text-foreground transition shrink-0 self-center"
          aria-label="Remove job"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
