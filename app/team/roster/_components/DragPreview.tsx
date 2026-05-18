import { GripVertical } from "lucide-react";
import type { DragData } from "./dnd-types";

/** Lightweight floating preview rendered inside dnd-kit's DragOverlay. */
export function DragPreview({ data }: { data: DragData }) {
  const label = data.display_name;
  return (
    <div className="rounded-md border border-foreground bg-background px-3 py-2 text-sm shadow-lg flex items-center gap-2 max-w-xs cursor-grabbing">
      <GripVertical className="h-3.5 w-3.5 text-gray-300" />
      <span className="truncate font-medium">{label}</span>
    </div>
  );
}
