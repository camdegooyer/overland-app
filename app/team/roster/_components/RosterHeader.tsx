"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addDaysISO, longDate, todayISO } from "@/lib/roster/dates";
import { RosterTabs } from "./RosterTabs";
import {
  publishUnpublishedInRange,
  republishAllInRange,
} from "../_actions/publish";

type PublishResult = {
  cardIds: string[];
  assignmentIds: string[];
};

type Props = {
  weekStart: string;
  weekEnd: string;
  onPublishApplied?: (updates: PublishResult) => void;
};

export function RosterHeader({
  weekStart,
  weekEnd,
  onPublishApplied,
}: Props) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [, startTransition] = useTransition();

  function navWeek(dateISO: string) {
    router.push(`/team/roster?week=${dateISO}`);
  }

  function runPublish(kind: "unpublished" | "all") {
    setPublishing(true);
    startTransition(async () => {
      const fn =
        kind === "all" ? republishAllInRange : publishUnpublishedInRange;
      const res = await fn({ week_start: weekStart, week_end: weekEnd });
      setPublishing(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const total = res.cardsPublished + res.assignmentsPublished;
      if (total === 0) {
        toast.info("Nothing to publish — everything's up to date.");
      } else {
        // Apply the status flip to local state so the UI reflects it
        // immediately without waiting for a server roundtrip.
        onPublishApplied?.({
          cardIds: res.cardIds,
          assignmentIds: res.assignmentIds,
        });
        const publishMsg = `Published ${res.cardsPublished} card${res.cardsPublished === 1 ? "" : "s"} and ${res.assignmentsPublished} job${res.assignmentsPublished === 1 ? "" : "s"}.`;
        const notifyParts: string[] = [];
        if (res.notificationsSent > 0)
          notifyParts.push(`emailed ${res.notificationsSent}`);
        if (res.notificationsSkipped > 0)
          notifyParts.push(`skipped ${res.notificationsSkipped}`);
        if (res.notificationsFailed > 0)
          notifyParts.push(`${res.notificationsFailed} failed`);
        const notifyMsg = notifyParts.length
          ? ` Notified: ${notifyParts.join(", ")}.`
          : "";
        toast.success(publishMsg + notifyMsg);
      }
      router.refresh();
    });
  }

  return (
    <div className="px-6 pt-8 pb-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-medium">Roster</h1>
          <p className="text-base text-gray-500 mt-1">
            Week of {longDate(weekStart)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navWeek(addDaysISO(weekStart, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navWeek(todayISO())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navWeek(addDaysISO(weekStart, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="inline-flex">
            <Button
              size="sm"
              disabled={publishing}
              onClick={() => runPublish("unpublished")}
              className="rounded-r-none border-r border-background/20"
            >
              {publishing ? "Publishing…" : "Publish"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="sm"
                    disabled={publishing}
                    className="rounded-l-none px-2"
                    aria-label="Publish options"
                  />
                }
              >
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => runPublish("unpublished")}>
                  Publish unpublished
                  <span className="ml-auto text-xs text-muted-foreground">
                    draft + changed
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runPublish("all")}>
                  Republish everything
                  <span className="ml-auto text-xs text-muted-foreground">
                    re-notify all
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <RosterTabs active="week" />
    </div>
  );
}
