"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  EmployeeDayCardRow,
  RosterAssignmentRow,
} from "@/lib/roster/queries";
import type {
  RosterEmployee,
  RosterOtherItem,
  RosterProject,
} from "@/lib/roster/types";
import { humanDate } from "@/lib/roster/dates";
import { updateEmployeeDayCard } from "../_actions/cards";
import { updateRosterAssignment } from "../_actions/assignments";

export type DetailsSheetState =
  | {
      kind: "card";
      card: EmployeeDayCardRow;
      employee: RosterEmployee | undefined;
    }
  | {
      kind: "assignment";
      assignment: RosterAssignmentRow;
      project: RosterProject | undefined;
      otherItem: RosterOtherItem | undefined;
    }
  | null;

type Props = {
  state: DetailsSheetState;
  onClose: () => void;
  onCardSaved: (card: EmployeeDayCardRow) => void;
  onAssignmentSaved: (assignment: RosterAssignmentRow) => void;
};

function trimSeconds(t: string) {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function normaliseTime(t: string) {
  return t.length === 5 ? `${t}:00` : t;
}

export function DetailsSheet({
  state,
  onClose,
  onCardSaved,
  onAssignmentSaved,
}: Props) {
  return (
    <Sheet open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex flex-col gap-0">
        {state && (
          <DetailsForm
            // Re-mount whenever the target changes so form state resets to
            // the new row's values without an effect.
            key={
              state.kind === "card"
                ? `card:${state.card.id}`
                : `assignment:${state.assignment.id}`
            }
            state={state}
            onClose={onClose}
            onCardSaved={onCardSaved}
            onAssignmentSaved={onAssignmentSaved}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailsForm({
  state,
  onClose,
  onCardSaved,
  onAssignmentSaved,
}: {
  state: NonNullable<DetailsSheetState>;
  onClose: () => void;
  onCardSaved: (card: EmployeeDayCardRow) => void;
  onAssignmentSaved: (assignment: RosterAssignmentRow) => void;
}) {
  const isCard = state.kind === "card";
  const isOtherAssignment =
    state.kind === "assignment" && state.otherItem !== undefined;
  // Other-item assignments don't have an Area concept; projects do.
  const showAreaField = state.kind === "assignment" && !isOtherAssignment;

  const [start, setStart] = useState(
    trimSeconds(isCard ? state.card.start_time : state.assignment.start_time),
  );
  const [finish, setFinish] = useState(
    trimSeconds(isCard ? state.card.finish_time : state.assignment.finish_time),
  );
  const [area, setArea] = useState(isCard ? "" : state.assignment.area ?? "");
  const [notes, setNotes] = useState(
    isCard ? state.card.card_notes ?? "" : state.assignment.notes ?? "",
  );
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const displayName = isCard
    ? [state.employee?.display_first_name, state.employee?.last_name]
        .filter(Boolean)
        .join(" ") || "Unknown employee"
    : state.otherItem?.label ??
      state.project?.derived_label ??
      state.project?.job_code ??
      "Unknown entry";

  const subtitle = isCard
    ? humanDate(state.card.roster_date)
    : isOtherAssignment
      ? "Other item"
      : state.project?.suburb ?? state.project?.job_code ?? "";

  function handleSave() {
    if (!start || !finish) {
      toast.error("Start and finish times are required.");
      return;
    }
    if (finish <= start) {
      toast.error("Finish time must be after start time.");
      return;
    }

    setSaving(true);
    startTransition(async () => {
      if (state.kind === "card") {
        const res = await updateEmployeeDayCard({
          card_id: state.card.id,
          start_time: normaliseTime(start),
          finish_time: normaliseTime(finish),
          card_notes: notes,
        });
        setSaving(false);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        if (res.data) onCardSaved(res.data as EmployeeDayCardRow);
        toast.success("Saved.");
        onClose();
      } else {
        const res = await updateRosterAssignment({
          assignment_id: state.assignment.id,
          start_time: normaliseTime(start),
          finish_time: normaliseTime(finish),
          area,
          notes,
        });
        setSaving(false);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        if (res.data) onAssignmentSaved(res.data as RosterAssignmentRow);
        toast.success("Saved.");
        onClose();
      }
    });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{displayName}</SheetTitle>
        <SheetDescription>{subtitle}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ds-start">Start</Label>
            <Input
              id="ds-start"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-finish">Finish</Label>
            <Input
              id="ds-finish"
              type="time"
              value={finish}
              onChange={(e) => setFinish(e.target.value)}
            />
          </div>
        </div>

        {showAreaField && (
          <div className="space-y-1.5">
            <Label htmlFor="ds-area">Area</Label>
            <Input
              id="ds-area"
              placeholder="e.g. ground floor framing"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="ds-notes">Notes</Label>
          <Textarea
            id="ds-notes"
            placeholder={
              isCard
                ? "Notes for the whole day (visible on display screens)…"
                : "Notes for this job (visible on display screens)…"
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
          />
        </div>
      </div>

      <SheetFooter className="flex-row justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </SheetFooter>
    </>
  );
}
