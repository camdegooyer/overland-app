import Link from "next/link";
import { StickyNote } from "lucide-react";
import { requireTeamMember } from "@/lib/auth/guard";
import { SignedInHeader } from "@/app/_components/SignedInHeader";
import { createClient } from "@/lib/supabase/server";
import {
  getRosterOtherItems,
  getRosterProjects,
  type EmployeeDayCardRow,
  type RosterAssignmentRow,
} from "@/lib/roster/queries";
import {
  addDaysISO,
  formatRange,
  humanDate,
  todayISO,
} from "@/lib/roster/dates";

/**
 * Read-only "my shifts" view for staff. Shows the logged-in employee's own
 * published cards + assignments for today + next 7 days. Filtered server-side
 * by employee_id so a staff user only ever sees their own data.
 */
export default async function MyShifts() {
  const { user, displayName, employeeId } = await requireTeamMember();

  const todayDate = todayISO();
  const horizonDate = addDaysISO(todayDate, 7);

  const supabase = await createClient();
  const [{ data: cardsData }, projects, otherItems] = await Promise.all([
    employeeId
      ? supabase
          .from("employee_day_cards")
          .select(
            "id, employee_id, roster_date, start_time, finish_time, card_notes, status, sort_order",
          )
          .eq("employee_id", employeeId)
          .eq("status", "published")
          .gte("roster_date", todayDate)
          .lte("roster_date", horizonDate)
          .order("roster_date")
      : Promise.resolve({ data: [] }),
    getRosterProjects(),
    getRosterOtherItems(),
  ]);

  const cards = (cardsData ?? []) as EmployeeDayCardRow[];
  const cardIds = cards.map((c) => c.id);

  let assignments: RosterAssignmentRow[] = [];
  if (cardIds.length > 0) {
    const { data: aData } = await supabase
      .from("roster_assignments")
      .select(
        "id, employee_day_card_id, project_id, other_item_id, start_time, finish_time, area, notes, status, sort_order",
      )
      .in("employee_day_card_id", cardIds)
      .eq("status", "published");
    assignments = (aData ?? []) as RosterAssignmentRow[];
  }

  const projectsById = new Map(projects.map((p) => [p.project_id, p]));
  const otherItemsById = new Map(otherItems.map((o) => [o.id, o]));
  const assignmentsByCard = new Map<string, RosterAssignmentRow[]>();
  for (const a of assignments) {
    const arr = assignmentsByCard.get(a.employee_day_card_id) ?? [];
    arr.push(a);
    assignmentsByCard.set(a.employee_day_card_id, arr);
  }

  return (
    <>
      <SignedInHeader
        area="Your roster"
        displayName={displayName}
        email={user.email!}
      />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-12">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-medium mb-2">My shifts</h1>
          <p className="text-base text-gray-500">
            Your published shifts for the next 8 days.
          </p>
          <div className="mt-4 text-sm">
            <Link
              href="/me/roster"
              className="text-foreground underline underline-offset-[3px] decoration-2 hover:no-underline"
            >
              See the whole team&apos;s roster →
            </Link>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="text-center text-gray-500 italic text-sm border border-dashed border-gray-100 rounded-lg py-16">
            No shifts scheduled in the next 8 days.
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((card) => {
              const cardAssignments = assignmentsByCard.get(card.id) ?? [];
              return (
                <div
                  key={card.id}
                  className="rounded-lg border border-gray-300 bg-background overflow-hidden"
                >
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                    <h2 className="font-medium">{humanDate(card.roster_date)}</h2>
                    <span className="text-sm text-gray-500">
                      {formatRange(card.start_time, card.finish_time)}
                    </span>
                  </div>
                  {card.card_notes && (
                    <div className="px-5 py-2 text-sm text-gray-500 flex items-start gap-1.5 border-b border-gray-100">
                      <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span className="whitespace-pre-wrap">
                        {card.card_notes}
                      </span>
                    </div>
                  )}
                  <div className="px-5 py-3 space-y-2">
                    {cardAssignments.length === 0 ? (
                      <div className="text-sm text-gray-500 italic">
                        No job assigned.
                      </div>
                    ) : (
                      cardAssignments.map((a) => {
                        const project = a.project_id
                          ? projectsById.get(a.project_id)
                          : undefined;
                        const otherItem = a.other_item_id
                          ? otherItemsById.get(a.other_item_id)
                          : undefined;
                        const label =
                          otherItem?.label ??
                          project?.derived_label ??
                          project?.job_code ??
                          "(unknown)";
                        const colour =
                          otherItem?.colour ?? project?.colour ?? "#9c9c9c";
                        const sameAsCard =
                          a.start_time === card.start_time &&
                          a.finish_time === card.finish_time;
                        return (
                          <div
                            key={a.id}
                            className="flex items-stretch gap-2 rounded border border-gray-100"
                          >
                            <div
                              className="w-1.5 shrink-0 rounded-l"
                              style={{ backgroundColor: colour }}
                            />
                            <div className="flex-1 py-2 pr-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{label}</span>
                                {!sameAsCard && (
                                  <span className="text-xs text-gray-500">
                                    {formatRange(a.start_time, a.finish_time)}
                                  </span>
                                )}
                              </div>
                              {a.area && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  Area: {a.area}
                                </div>
                              )}
                              {a.notes && (
                                <div className="text-xs text-gray-500 mt-1 flex items-start gap-1.5">
                                  <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span className="whitespace-pre-wrap">
                                    {a.notes}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
