/**
 * Discriminated unions for dnd-kit drag/drop data payloads.
 * Read via `active.data.current` and `over.data.current` in onDragEnd.
 */

export type DragData =
  | { type: "employee-source"; employee_id: string; display_name: string }
  | { type: "job-source"; project_id: string; display_name: string }
  | { type: "other-source"; other_item_id: string; display_name: string }
  | {
      type: "employee-day-card";
      card_id: string;
      employee_id: string;
      display_name: string;
    }
  | {
      type: "roster-assignment";
      assignment_id: string;
      project_id: string | null;
      other_item_id: string | null;
      employee_day_card_id: string;
      display_name: string;
    };

export type DropData =
  | { type: "day-column"; date: string }
  | { type: "employee-day-card"; card_id: string; roster_date: string };
