import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const ROSTER_TZ = "Australia/Melbourne";

/** Today's date in Melbourne, as YYYY-MM-DD. */
export function todayISO(): string {
  return format(toZonedTime(new Date(), ROSTER_TZ), "yyyy-MM-dd");
}

/**
 * Map our ISO `week_starts_on` (1=Mon, 7=Sun) to date-fns convention
 * (0=Sun, 1=Mon, …).
 */
function toDateFnsWeekStart(weekStartsOn: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  if (weekStartsOn === 7) return 0;
  return Math.max(0, Math.min(6, weekStartsOn)) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Inclusive 7-day list of dates (YYYY-MM-DD) covering the week containing
 * `anchor`. If `showWeekends` is false, returns the 5 weekdays only.
 */
export function getWeekDates(
  anchorISO: string,
  weekStartsOn: number,
  showWeekends: boolean,
): string[] {
  const anchor = parseISO(anchorISO);
  const start = startOfWeek(anchor, {
    weekStartsOn: toDateFnsWeekStart(weekStartsOn),
  });
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const dow = d.getDay(); // 0=Sun, 6=Sat
    if (!showWeekends && (dow === 0 || dow === 6)) continue;
    days.push(format(d, "yyyy-MM-dd"));
  }
  return days;
}

/** "Monday 18th" style day-and-date label. */
export function shortDayLabel(dateISO: string): string {
  return format(parseISO(dateISO), "EEEE do");
}

/** "Monday" style full day label. */
export function fullDayLabel(dateISO: string): string {
  return format(parseISO(dateISO), "EEEE");
}

/** "May 2026" style month label. */
export function monthLabel(dateISO: string): string {
  return format(parseISO(dateISO), "MMMM yyyy");
}

/** "11th May 2026" style long date. */
export function longDate(dateISO: string): string {
  return format(parseISO(dateISO), "do MMMM yyyy");
}

/** "Monday, 18th May 2026" style long human date with day name. */
export function humanDate(dateISO: string): string {
  return format(parseISO(dateISO), "EEEE, do MMMM yyyy");
}

/** True if `dateISO` is today in Melbourne. */
export function isTodayISO(dateISO: string): boolean {
  return isSameDay(parseISO(dateISO), parseISO(todayISO()));
}

/** ISO day-of-week of `dateISO`: 1=Monday .. 7=Sunday. */
export function isoDayOfWeek(dateISO: string): number {
  const jsDow = parseISO(dateISO).getDay(); // 0=Sun .. 6=Sat
  return jsDow === 0 ? 7 : jsDow;
}

/**
 * Trim seconds off a HH:MM:SS Postgres time. "07:30:00" → "7:30".
 * Strips leading zero on the hour for a more natural display.
 */
export function formatTime(t: string | null): string {
  if (!t) return "";
  const hhmm = t.length >= 5 ? t.slice(0, 5) : t;
  const [h, m] = hhmm.split(":");
  const hour = String(Number(h));
  return `${hour}:${m}`;
}

/** "7:30–4:30" for a card. */
export function formatRange(start: string | null, finish: string | null): string {
  if (!start || !finish) return "";
  return `${formatTime(start)}–${formatTime(finish)}`;
}

/**
 * Add `days` to a YYYY-MM-DD string, returning a new YYYY-MM-DD string.
 * Used for week navigation (+7 / -7).
 */
export function addDaysISO(dateISO: string, days: number): string {
  return format(addDays(parseISO(dateISO), days), "yyyy-MM-dd");
}

// ----------------------------------------------------------------- month -----

/** First day of the month containing `dateISO`. */
export function startOfMonthISO(dateISO: string): string {
  return format(startOfMonth(parseISO(dateISO)), "yyyy-MM-dd");
}

/** Last day of the month containing `dateISO`. */
export function endOfMonthISO(dateISO: string): string {
  return format(endOfMonth(parseISO(dateISO)), "yyyy-MM-dd");
}

/** Add `months` to a YYYY-MM-DD string. */
export function addMonthsISO(dateISO: string, months: number): string {
  return format(addMonths(parseISO(dateISO), months), "yyyy-MM-dd");
}

/**
 * Returns the 35–42 dates that make up a month grid (with leading/trailing
 * days from neighbouring months so each row is a full week).
 * Each entry carries `isCurrentMonth` so the UI can dim outside-of-month days.
 */
export function getMonthGridDates(
  anchorISO: string,
  weekStartsOn: number,
): { dateISO: string; isCurrentMonth: boolean }[] {
  const anchor = parseISO(anchorISO);
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, {
    weekStartsOn: toDateFnsWeekStart(weekStartsOn),
  });
  const gridEnd = endOfWeek(monthEnd, {
    weekStartsOn: toDateFnsWeekStart(weekStartsOn),
  });

  const out: { dateISO: string; isCurrentMonth: boolean }[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    out.push({
      dateISO: format(cursor, "yyyy-MM-dd"),
      isCurrentMonth: isSameMonth(cursor, monthStart),
    });
    cursor = addDays(cursor, 1);
  }
  return out;
}
