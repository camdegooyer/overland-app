"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRange } from "@/lib/roster/dates";

function trimSeconds(t: string) {
  return t.length === 8 ? t.slice(0, 5) : t;
}

export type SplitTimePromptState = {
  card_id: string;
  /** Discriminator: project assignment vs other-item assignment. */
  kind: "project" | "other";
  /** UUID of the project or other_item being added. */
  target_id: string;
  /** Display name for the dialog. */
  target_name: string;
  card_start: string;
  card_finish: string;
  /** Suggested defaults — typically the latest existing assignment's finish → card.finish. */
  suggested_start: string;
  suggested_finish: string;
};

type Props = {
  state: SplitTimePromptState | null;
  onConfirm: (start: string, finish: string) => void;
  onCancel: () => void;
};

export function SplitTimeDialog({ state, onConfirm, onCancel }: Props) {
  const [start, setStart] = useState("");
  const [finish, setFinish] = useState("");

  // Re-sync inputs when a new prompt opens.
  if (state && start === "" && finish === "") {
    setStart(trimSeconds(state.suggested_start));
    setFinish(trimSeconds(state.suggested_finish));
  }

  function handleClose() {
    setStart("");
    setFinish("");
    onCancel();
  }

  function handleConfirm() {
    onConfirm(start, finish);
    setStart("");
    setFinish("");
  }

  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {state?.kind === "other"
              ? "Set times for additional item"
              : "Set times for second job"}
          </DialogTitle>
          <DialogDescription>
            {state ? (
              <>
                Adding{" "}
                <span className="text-foreground font-medium">
                  {state.target_name}
                </span>{" "}
                to a card with existing entries. Day runs{" "}
                {formatRange(state.card_start, state.card_finish)}.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="split-start">Start</Label>
            <Input
              id="split-start"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="split-finish">Finish</Label>
            <Input
              id="split-finish"
              type="time"
              value={finish}
              onChange={(e) => setFinish(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!start || !finish}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
