import { requireAdmin } from "@/lib/auth/guard";
import {
  getRosterEmployees,
  getRosterOtherItems,
  getRosterProjects,
  getRosterSettings,
  getWeekRosterData,
} from "@/lib/roster/queries";
import { getWeekDates, todayISO } from "@/lib/roster/dates";
import { ByJobView } from "./_components/ByJobView";

type SearchParams = Promise<{ week?: string }>;

export default async function RosterByJob({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const { week } = await searchParams;
  const anchor = week ?? todayISO();

  const settings = await getRosterSettings();
  const weekDates = getWeekDates(
    anchor,
    settings.week_starts_on,
    settings.show_weekends,
  );
  const weekStart = weekDates[0];
  const weekEnd = weekDates[weekDates.length - 1];

  const [employees, projects, otherItems, weekData] = await Promise.all([
    getRosterEmployees(),
    getRosterProjects(),
    getRosterOtherItems(),
    getWeekRosterData(weekStart, weekEnd),
  ]);

  return (
    <ByJobView
      weekStart={weekStart}
      weekDates={weekDates}
      cards={weekData.cards}
      assignments={weekData.assignments}
      employees={employees}
      projects={projects}
      otherItems={otherItems}
    />
  );
}
