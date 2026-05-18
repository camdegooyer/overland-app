"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RosterProject } from "@/lib/roster/types";
import type { DragData } from "./dnd-types";

type Props = { project: RosterProject };

export function JobSourceCard({ project }: Props) {
  const displayName = project.derived_label ?? project.job_code ?? "(unnamed)";

  const data: DragData = {
    type: "job-source",
    project_id: project.project_id,
    display_name: displayName,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `job-source:${project.project_id}`,
    data,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "group flex items-stretch gap-2 rounded-md border border-gray-100 bg-background pr-3 py-2 text-sm cursor-grab active:cursor-grabbing overflow-hidden",
        isDragging && "opacity-40",
      )}
    >
      <div
        className="w-1 shrink-0 rounded-r"
        style={{ backgroundColor: project.colour }}
      />
      <GripVertical className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition self-center" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{displayName}</div>
        {project.stage && (
          <div className="text-xs text-gray-500 truncate">{project.stage}</div>
        )}
      </div>
    </div>
  );
}
