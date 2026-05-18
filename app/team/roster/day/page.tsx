import { requireRole } from "@/lib/auth/guard";
import {
  getRosterEmployees,
  getRosterOtherItems,
  getRosterProjects,
  getWeekRosterData,
} from "@/lib/roster/queries";
import { todayISO } from "@/lib/roster/dates";
import { DayView } from "./_components/DayView";

type SearchParams = Promise<{ d?: string }>;

export default async function RosterDay({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("team");
  const { d } = await searchParams;
  const date = d ?? todayISO();

  const [employees, projects, otherItems, dayData] = await Promise.all([
    getRosterEmployees(),
    getRosterProjects(),
    getRosterOtherItems(),
    getWeekRosterData(date, date),
  ]);

  return (
    <DayView
      date={date}
      cards={dayData.cards}
      assignments={dayData.assignments}
      employees={employees}
      projects={projects}
      otherItems={otherItems}
    />
  );
}
