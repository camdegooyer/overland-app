"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RosterTabs } from "./RosterTabs";

type Active = "day" | "by-job" | "month" | "notes";

type Props = {
  active: Active;
  title: string;
  subtitle?: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  prevLabel?: string;
  nextLabel?: string;
};

/**
 * Shared header for read-only roster views: title + prev/today/next nav + tabs.
 * Mirrors RosterHeader's chrome minus the publish button (no mutations here).
 */
export function ReadOnlyViewHeader({
  active,
  title,
  subtitle,
  onPrev,
  onNext,
  onToday,
  prevLabel = "Previous",
  nextLabel = "Next",
}: Props) {
  return (
    <div className="px-6 pt-8 pb-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-medium">{title}</h1>
          {subtitle && (
            <p className="text-base text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrev}
            aria-label={prevLabel}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onToday}>
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            aria-label={nextLabel}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <RosterTabs active={active} />
    </div>
  );
}

/** Local hook just to keep view components terse. */
export function useRouterPush() {
  const router = useRouter();
  return (href: string) => router.push(href);
}
