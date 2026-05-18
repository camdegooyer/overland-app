import { requireAdmin } from "@/lib/auth/guard";
import {
  getRosterableEmployees,
  getRosterEmployees,
  getRosterOtherItems,
  getRosterProjects,
  getRosterSettings,
  getWeekRosterData,
} from "@/lib/roster/queries";
import { getWeekDates, todayISO } from "@/lib/roster/dates";
import { RosterBoard } from "./_components/RosterBoard";

type SearchParams = Promise<{ week?: string }>;

export default async function RosterWeek({
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

  const [
    rosterable,
    allEmployees,
    visibleProjects,
    allProjects,
    otherItems,
    weekData,
  ] = await Promise.all([
    getRosterableEmployees(),
    getRosterEmployees(),
    getRosterProjects({ visibleOnly: true }),
    getRosterProjects(),
    getRosterOtherItems({ activeOnly: true }),
    getWeekRosterData(weekStart, weekEnd),
  ]);

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      <RosterBoard
        key={weekStart}
        weekDates={weekDates}
        weekStart={weekStart}
        weekEnd={weekEnd}
        initialData={weekData}
        rosterableEmployees={rosterable}
        allEmployees={allEmployees}
        visibleProjects={visibleProjects}
        allProjects={allProjects}
        otherItems={otherItems}
        settings={settings}
      />
    </div>
  );
}
