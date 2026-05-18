"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RosterOtherItem } from "@/lib/roster/types";
import type { DragData } from "./dnd-types";

type Props = { item: RosterOtherItem };

export function OtherSourceCard({ item }: Props) {
  const data: DragData = {
    type: "other-source",
    other_item_id: item.id,
    display_name: item.label,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `other-source:${item.id}`,
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
        style={{ backgroundColor: item.colour }}
      />
      <GripVertical className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 transition self-center" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.label}</div>
      </div>
    </div>
  );
}
