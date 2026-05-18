import { requireTeamMember } from "@/lib/auth/guard";
import { SignedInHeader } from "@/app/_components/SignedInHeader";
import {
  getRosterEmployees,
  getRosterOtherItems,
  getRosterProjects,
  getRosterSettings,
  getWeekRosterData,
} from "@/lib/roster/queries";
import { getWeekDates, todayISO } from "@/lib/roster/dates";
import { ReadOnlyRosterWeek } from "./_components/ReadOnlyRosterWeek";

type SearchParams = Promise<{ week?: string }>;

/**
 * Staff view of the whole team's roster. Read-only — no drag, no edit, no
 * publish. Only shows published cards/assignments (drafts and changes don't
 * exist to staff until they're committed).
 */
export default async function MeRoster({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user, displayName } = await requireTeamMember();
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

  // Staff only see published rows.
  const publishedCards = weekData.cards.filter(
    (c) => c.status === "published",
  );
  const publishedCardIds = new Set(publishedCards.map((c) => c.id));
  const publishedAssignments = weekData.assignments.filter(
    (a) =>
      a.status === "published" && publishedCardIds.has(a.employee_day_card_id),
  );

  return (
    <>
      <SignedInHeader
        area="Your roster"
        displayName={displayName}
        email={user.email!}
      />
      <ReadOnlyRosterWeek
        weekStart={weekStart}
        weekDates={weekDates}
        cards={publishedCards}
        assignments={publishedAssignments}
        employees={employees}
        projects={projects}
        otherItems={otherItems}
      />
    </>
  );
}
