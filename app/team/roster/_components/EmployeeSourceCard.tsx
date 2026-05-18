"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RosterEmployee } from "@/lib/roster/types";
import type { DragData } from "./dnd-types";

type Props = { employee: RosterEmployee };

export function EmployeeSourceCard({ employee }: Props) {
  const displayName =
    [employee.display_first_name, employee.last_name]
      .filter(Boolean)
      .join(" ") || "(no name)";

  const data: DragData = {
    type: "employee-source",
    employee_id: employee.id,
    display_name: displayName,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `employee-source:${employee.id}`,
    data,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "group flex items-center gap-2 rounded-md border border-gray-100 bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{displayName}</div>
        {employee.trade && (
          <div className="text-xs text-gray-500 truncate">{employee.trade}</div>
        )}
      </div>
    </div>
  );
}
