"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  RosterDayDefault,
  RosterSettings,
} from "@/lib/roster/types";
import { updateRosterSettings } from "../_actions/settings";

function trimSeconds(t: string) {
  return t.length === 8 ? t.slice(0, 5) : t;
}

const DAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
];

type Props = {
  initial: RosterSettings;
  dayDefaults: RosterDayDefault[];
};

export function SettingsForm({ initial, dayDefaults }: Props) {
  // Build a 7-row state seeded from the DB. If any row is missing (shouldn't
  // happen after the migration), fall back to the global default.
  const seededDays = DAYS.map((d) => {
    const match = dayDefaults.find((dd) => dd.day_of_week === d.value);
    return {
      day_of_week: d.value,
      start_time: trimSeconds(match?.start_time ?? initial.default_start_time),
      finish_time: trimSeconds(
        match?.finish_time ?? initial.default_finish_time,
      ),
    };
  });

  const [days, setDays] = useState(seededDays);
  const [breakMin, setBreakMin] = useState(
    String(initial.default_break_minutes),
  );
  const [split, setSplit] = useState(
    trimSeconds(initial.default_split_start_time),
  );
  const [weekStart, setWeekStart] = useState(initial.week_starts_on);
  const [weekends, setWeekends] = useState(initial.show_weekends);
  const [isPending, startTransition] = useTransition();

  function updateDay(dow: number, field: "start_time" | "finish_time", value: string) {
    setDays((prev) =>
      prev.map((d) => (d.day_of_week === dow ? { ...d, [field]: value } : d)),
    );
  }

  function applyToAllDays(field: "start_time" | "finish_time", value: string) {
    setDays((prev) => prev.map((d) => ({ ...d, [field]: value })));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateRosterSettings({
        default_break_minutes: Number(breakMin),
        default_split_start_time: split,
        week_starts_on: weekStart,
        show_weekends: weekends,
        day_defaults: days,
      });
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("Saved");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8 max-w-2xl">
      <section>
        <div className="mb-3">
          <h2 className="text-base font-medium">Daily start &amp; finish</h2>
          <p className="text-sm text-gray-500 mt-1">
            These pre-fill a new employee-day card based on the weekday. Edit
            an individual day to override (e.g. shorter Fridays).
          </p>
        </div>

        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral/40">
                <th className="text-left font-medium px-3 py-2 w-32">Day</th>
                <th className="text-left font-medium px-3 py-2">Start</th>
                <th className="text-left font-medium px-3 py-2">Finish</th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d, i) => {
                const row = days.find((x) => x.day_of_week === d.value)!;
                return (
                  <tr
                    key={d.value}
                    className={i % 2 === 1 ? "bg-neutral/20" : undefined}
                  >
                    <td className="px-3 py-1.5">{d.label}</td>
                    <td className="px-3 py-1.5">
                      <Input
                        type="time"
                        value={row.start_time}
                        onChange={(e) =>
                          updateDay(d.value, "start_time", e.target.value)
                        }
                        onDoubleClick={() =>
                          applyToAllDays("start_time", row.start_time)
                        }
                        title="Double-click to apply to all days"
                        className="h-8 w-32"
                        required
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        type="time"
                        value={row.finish_time}
                        onChange={(e) =>
                          updateDay(d.value, "finish_time", e.target.value)
                        }
                        onDoubleClick={() =>
                          applyToAllDays("finish_time", row.finish_time)
                        }
                        title="Double-click to apply to all days"
                        className="h-8 w-32"
                        required
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Tip: double-click any time field to copy it across all seven days.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-medium">Other defaults</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="break">Break minutes</Label>
            <Input
              id="break"
              type="number"
              min={0}
              max={240}
              value={breakMin}
              onChange={(e) => setBreakMin(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="split">Split-day start</Label>
            <Input
              id="split"
              type="time"
              value={split}
              onChange={(e) => setSplit(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500">
              Default start time for a second job assignment on a split day.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="weekStart">Week starts on</Label>
          <Select
            value={String(weekStart)}
            onValueChange={(v) => setWeekStart(Number(v))}
          >
            <SelectTrigger id="weekStart" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-100 p-4">
          <div>
            <Label htmlFor="weekends" className="text-base">
              Show weekends
            </Label>
            <p className="text-xs text-gray-500 mt-1">
              When off, the week view shows Mon–Fri only.
            </p>
          </div>
          <Switch
            id="weekends"
            checked={weekends}
            onCheckedChange={setWeekends}
          />
        </div>
      </section>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
