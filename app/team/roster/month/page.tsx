import { requireAdmin } from "@/lib/auth/guard";
import {
  getRosterOtherItems,
  getRosterProjects,
  getRosterSettings,
  getWeekRosterData,
} from "@/lib/roster/queries";
import {
  getMonthGridDates,
  todayISO,
} from "@/lib/roster/dates";
import { MonthView } from "./_components/MonthView";

type SearchParams = Promise<{ m?: string }>;

const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const WEEKDAY_LABELS_SUN_FIRST = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default async function RosterMonth({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const { m } = await searchParams;
  const anchor = m ?? todayISO();

  const settings = await getRosterSettings();
  const gridCells = getMonthGridDates(anchor, settings.week_starts_on);

  // Fetch all data within the grid range — grid always starts on a week
  // boundary and ends on one, so first/last dateISO bound the query.
  const rangeStart = gridCells[0].dateISO;
  const rangeEnd = gridCells[gridCells.length - 1].dateISO;

  const [projects, otherItems, rangeData] = await Promise.all([
    getRosterProjects(),
    getRosterOtherItems(),
    getWeekRosterData(rangeStart, rangeEnd),
  ]);

  const weekdayLabels =
    settings.week_starts_on === 7 ? WEEKDAY_LABELS_SUN_FIRST : WEEKDAY_LABELS;

  return (
    <MonthView
      anchor={anchor}
      gridCells={gridCells}
      weekdayLabels={weekdayLabels}
      cards={rangeData.cards}
      assignments={rangeData.assignments}
      projects={projects}
      otherItems={otherItems}
    />
  );
}
