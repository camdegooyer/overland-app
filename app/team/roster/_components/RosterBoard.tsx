"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import type {
  EmployeeDayCardRow,
  RosterAssignmentRow,
  WeekRosterData,
} from "@/lib/roster/queries";
import type {
  RosterEmployee,
  RosterOtherItem,
  RosterProject,
  RosterSettings,
} from "@/lib/roster/types";
import { SidePanel } from "./SidePanel";
import { DayColumn } from "./DayColumn";
import { DragPreview } from "./DragPreview";
import { RosterHeader } from "./RosterHeader";
import {
  SplitTimeDialog,
  type SplitTimePromptState,
} from "./SplitTimeDialog";
import { DetailsSheet, type DetailsSheetState } from "./DetailsSheet";
import type { DragData, DropData } from "./dnd-types";
import {
  bulkCreateEmployeeDayCards,
  createEmployeeDayCard,
  deleteEmployeeDayCard,
  moveEmployeeDayCard,
} from "../_actions/cards";
import {
  createRosterAssignment,
  deleteRosterAssignment,
  moveRosterAssignment,
} from "../_actions/assignments";

type Props = {
  weekDates: string[];
  weekStart: string;
  weekEnd: string;
  initialData: WeekRosterData;
  rosterableEmployees: RosterEmployee[];
  allEmployees: RosterEmployee[];
  visibleProjects: RosterProject[];
  allProjects: RosterProject[];
  otherItems: RosterOtherItem[];
  settings: RosterSettings;
};

let tempCounter = 0;
function tempId(prefix: string) {
  tempCounter += 1;
  return `temp-${prefix}-${tempCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Pick the suggested split start time for the second+ assignment dropped on
 * a card. Prefer the global default_split_start_time from settings (typically
 * 12:30) when it sits inside the card's working window. Fall back to the
 * latest existing assignment finish so a partially-filled card still gets a
 * sensible suggestion.
 */
function pickSplitStart(
  card: { start_time: string; finish_time: string },
  existingAssignments: RosterAssignmentRow[],
  settings: RosterSettings,
): string {
  const split = settings.default_split_start_time;
  if (split > card.start_time && split < card.finish_time) {
    return split;
  }
  return existingAssignments
    .map((a) => a.finish_time)
    .sort()
    .pop() ?? card.start_time;
}

export function RosterBoard({
  weekDates,
  weekStart,
  weekEnd,
  initialData,
  rosterableEmployees,
  allEmployees,
  visibleProjects,
  allProjects,
  otherItems,
  settings,
}: Props) {
  const [data, setData] = useState<WeekRosterData>(initialData);
  const [, startTransition] = useTransition();
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [splitPrompt, setSplitPrompt] = useState<SplitTimePromptState | null>(
    null,
  );
  const [details, setDetails] = useState<DetailsSheetState>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const employeesById = useMemo(
    () => new Map(allEmployees.map((e) => [e.id, e])),
    [allEmployees],
  );
  const projectsById = useMemo(
    () => new Map(allProjects.map((p) => [p.project_id, p])),
    [allProjects],
  );
  const otherItemsById = useMemo(
    () => new Map(otherItems.map((o) => [o.id, o])),
    [otherItems],
  );

  const cardsByDate = useMemo(() => {
    const m = new Map<string, EmployeeDayCardRow[]>();
    for (const c of data.cards) {
      const arr = m.get(c.roster_date) ?? [];
      arr.push(c);
      m.set(c.roster_date, arr);
    }
    return m;
  }, [data.cards]);

  const assignmentsByCard = useMemo(() => {
    const m = new Map<string, RosterAssignmentRow[]>();
    for (const a of data.assignments) {
      const arr = m.get(a.employee_day_card_id) ?? [];
      arr.push(a);
      m.set(a.employee_day_card_id, arr);
    }
    return m;
  }, [data.assignments]);

  // --------------------------------------------------------------- creators --

  function createCardOptimistic(
    employeeId: string,
    date: string,
  ): { tempId: string; promise: Promise<void> } | null {
    const exists = data.cards.some(
      (c) => c.employee_id === employeeId && c.roster_date === date,
    );
    if (exists) return null;

    const optimisticId = tempId("card");
    const optimistic: EmployeeDayCardRow = {
      id: optimisticId,
      employee_id: employeeId,
      roster_date: date,
      start_time: settings.default_start_time,
      finish_time: settings.default_finish_time,
      card_notes: null,
      status: "draft",
      sort_order: 0,
    };
    setData((d) => ({ ...d, cards: [...d.cards, optimistic] }));

    const promise = (async () => {
      const res = await createEmployeeDayCard({
        employee_id: employeeId,
        roster_date: date,
      });
      if (!res.ok) {
        setData((d) => ({
          ...d,
          cards: d.cards.filter((c) => c.id !== optimisticId),
        }));
        throw new Error(res.error);
      }
      setData((d) => ({
        ...d,
        cards: d.cards.map((c) =>
          c.id === optimisticId ? (res.data as EmployeeDayCardRow) : c,
        ),
      }));
    })();

    return { tempId: optimisticId, promise };
  }

  function createAssignmentOptimistic(args: {
    cardId: string;
    projectId?: string;
    otherItemId?: string;
    startTime: string;
    finishTime: string;
  }) {
    const optimisticId = tempId("assign");
    const optimistic: RosterAssignmentRow = {
      id: optimisticId,
      employee_day_card_id: args.cardId,
      project_id: args.projectId ?? null,
      other_item_id: args.otherItemId ?? null,
      start_time: args.startTime,
      finish_time: args.finishTime,
      area: null,
      notes: null,
      status: "draft",
      sort_order: 0,
    };
    setData((d) => ({ ...d, assignments: [...d.assignments, optimistic] }));

    startTransition(async () => {
      const res = await createRosterAssignment({
        employee_day_card_id: args.cardId,
        project_id: args.projectId,
        other_item_id: args.otherItemId,
        start_time: args.startTime,
        finish_time: args.finishTime,
      });
      if (!res.ok) {
        setData((d) => ({
          ...d,
          assignments: d.assignments.filter((a) => a.id !== optimisticId),
        }));
        toast.error(res.error);
      } else {
        setData((d) => ({
          ...d,
          assignments: d.assignments.map((a) =>
            a.id === optimisticId ? (res.data as RosterAssignmentRow) : a,
          ),
        }));
      }
    });
  }

  // --------------------------------------------------------------- handlers --

  function handleDeleteCard(cardId: string) {
    const previousCards = data.cards;
    const previousAssignments = data.assignments;
    setData((d) => ({
      cards: d.cards.filter((c) => c.id !== cardId),
      assignments: d.assignments.filter((a) => a.employee_day_card_id !== cardId),
    }));
    startTransition(async () => {
      const res = await deleteEmployeeDayCard({ card_id: cardId });
      if (!res.ok) {
        setData({ cards: previousCards, assignments: previousAssignments });
        toast.error(res.error);
      }
    });
  }

  function handleDeleteAssignment(assignmentId: string) {
    const previous = data.assignments;
    setData((d) => ({
      ...d,
      assignments: d.assignments.filter((a) => a.id !== assignmentId),
    }));
    startTransition(async () => {
      const res = await deleteRosterAssignment({
        assignment_id: assignmentId,
      });
      if (!res.ok) {
        setData((d) => ({ ...d, assignments: previous }));
        toast.error(res.error);
      }
    });
  }

  function handleAddAll(date: string) {
    const onDay = new Set(
      data.cards
        .filter((c) => c.roster_date === date)
        .map((c) => c.employee_id),
    );
    const toAdd = rosterableEmployees.filter((e) => !onDay.has(e.id));
    if (toAdd.length === 0) {
      toast.info("Everyone's already on this day.");
      return;
    }

    // Optimistic: drop in placeholder rows immediately, then reconcile with
    // the bulk-insert result.
    const optimisticIds = toAdd.map((e) => ({
      employee_id: e.id,
      temp_id: tempId("card"),
    }));
    const optimisticRows: EmployeeDayCardRow[] = optimisticIds.map(
      ({ employee_id, temp_id }) => ({
        id: temp_id,
        employee_id,
        roster_date: date,
        start_time: settings.default_start_time,
        finish_time: settings.default_finish_time,
        card_notes: null,
        status: "draft",
        sort_order: 0,
      }),
    );
    setData((d) => ({ ...d, cards: [...d.cards, ...optimisticRows] }));

    startTransition(async () => {
      const res = await bulkCreateEmployeeDayCards({
        employee_ids: toAdd.map((e) => e.id),
        roster_date: date,
      });
      if (!res.ok) {
        // Roll back the optimistic rows.
        const tempSet = new Set(optimisticIds.map((o) => o.temp_id));
        setData((d) => ({
          ...d,
          cards: d.cards.filter((c) => !tempSet.has(c.id)),
        }));
        toast.error(res.error);
        return;
      }

      const created = (res.data ?? []) as EmployeeDayCardRow[];
      const createdByEmployee = new Map(created.map((c) => [c.employee_id, c]));
      const tempSet = new Set(optimisticIds.map((o) => o.temp_id));

      setData((d) => {
        // Replace each optimistic row with its real counterpart; drop any
        // that didn't get created (e.g. already existed — race condition).
        const next = d.cards
          .map((c) => {
            if (!tempSet.has(c.id)) return c;
            return createdByEmployee.get(c.employee_id) ?? null;
          })
          .filter((c): c is EmployeeDayCardRow => c !== null);
        return { ...d, cards: next };
      });
      toast.success(`Added ${created.length} employees.`);
    });
  }

  function handleOpenCard(card: EmployeeDayCardRow) {
    if (card.id.startsWith("temp-")) return;
    setDetails({
      kind: "card",
      card,
      employee: employeesById.get(card.employee_id),
    });
  }

  function handleOpenAssignment(assignment: RosterAssignmentRow) {
    if (assignment.id.startsWith("temp-")) return;
    setDetails({
      kind: "assignment",
      assignment,
      project: assignment.project_id
        ? projectsById.get(assignment.project_id)
        : undefined,
      otherItem: assignment.other_item_id
        ? otherItemsById.get(assignment.other_item_id)
        : undefined,
    });
  }

  function handleCardSaved(card: EmployeeDayCardRow) {
    setData((d) => ({
      ...d,
      cards: d.cards.map((c) => (c.id === card.id ? card : c)),
    }));
  }

  function handleAssignmentSaved(assignment: RosterAssignmentRow) {
    setData((d) => ({
      ...d,
      assignments: d.assignments.map((a) =>
        a.id === assignment.id ? assignment : a,
      ),
    }));
  }

  function handlePublishApplied({
    cardIds,
    assignmentIds,
  }: {
    cardIds: string[];
    assignmentIds: string[];
  }) {
    const cardSet = new Set(cardIds);
    const assignmentSet = new Set(assignmentIds);
    setData((d) => ({
      cards: d.cards.map((c) =>
        cardSet.has(c.id) ? { ...c, status: "published" } : c,
      ),
      assignments: d.assignments.map((a) =>
        assignmentSet.has(a.id) ? { ...a, status: "published" } : a,
      ),
    }));
  }

  function handleSplitConfirm(start: string, finish: string) {
    if (!splitPrompt) return;
    const startTime = start.length === 5 ? `${start}:00` : start;
    const finishTime = finish.length === 5 ? `${finish}:00` : finish;
    if (splitPrompt.kind === "project") {
      createAssignmentOptimistic({
        cardId: splitPrompt.card_id,
        projectId: splitPrompt.target_id,
        startTime,
        finishTime,
      });
    } else {
      createAssignmentOptimistic({
        cardId: splitPrompt.card_id,
        otherItemId: splitPrompt.target_id,
        startTime,
        finishTime,
      });
    }
    setSplitPrompt(null);
  }

  // --------------------------------------------------------------- drag ----

  function onDragStart(e: DragStartEvent) {
    setActiveDrag((e.active.data.current as DragData | undefined) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const drag = event.active.data.current as DragData | undefined;
    const drop = event.over?.data.current as DropData | undefined;
    if (!drag || !drop) return;

    // --- employee-source → day-column: create card ---
    if (drag.type === "employee-source" && drop.type === "day-column") {
      const result = createCardOptimistic(drag.employee_id, drop.date);
      if (!result) {
        toast.error("That employee is already on the roster for this day.");
        return;
      }
      startTransition(async () => {
        try {
          await result.promise;
        } catch (e) {
          toast.error((e as Error).message);
        }
      });
      return;
    }

    // --- job-source → employee-day-card: create assignment ---
    if (drag.type === "job-source" && drop.type === "employee-day-card") {
      const card = data.cards.find((c) => c.id === drop.card_id);
      if (!card) return;
      const project = projectsById.get(drag.project_id);
      const existingAssignments = data.assignments.filter(
        (a) => a.employee_day_card_id === drop.card_id,
      );

      // First assignment: silent create with project defaults or card times.
      if (existingAssignments.length === 0) {
        const startTime = project?.default_start_time ?? card.start_time;
        const finishTime = project?.default_finish_time ?? card.finish_time;
        createAssignmentOptimistic({
          cardId: card.id,
          projectId: drag.project_id,
          startTime,
          finishTime,
        });
        return;
      }

      // Second+ assignment: open the split-time prompt.
      // Suggest start = settings.default_split_start_time if it falls within
      // the card window; otherwise fall back to the latest existing finish.
      setSplitPrompt({
        card_id: card.id,
        kind: "project",
        target_id: drag.project_id,
        target_name: drag.display_name,
        card_start: card.start_time,
        card_finish: card.finish_time,
        suggested_start: pickSplitStart(card, existingAssignments, settings),
        suggested_finish: card.finish_time,
      });
      return;
    }

    // --- other-source → employee-day-card: create other-item assignment ---
    if (drag.type === "other-source" && drop.type === "employee-day-card") {
      const card = data.cards.find((c) => c.id === drop.card_id);
      if (!card) return;
      const existingAssignments = data.assignments.filter(
        (a) => a.employee_day_card_id === drop.card_id,
      );

      if (existingAssignments.length === 0) {
        createAssignmentOptimistic({
          cardId: card.id,
          otherItemId: drag.other_item_id,
          startTime: card.start_time,
          finishTime: card.finish_time,
        });
        return;
      }

      setSplitPrompt({
        card_id: card.id,
        kind: "other",
        target_id: drag.other_item_id,
        target_name: drag.display_name,
        card_start: card.start_time,
        card_finish: card.finish_time,
        suggested_start: pickSplitStart(card, existingAssignments, settings),
        suggested_finish: card.finish_time,
      });
      return;
    }

    // --- employee-day-card → day-column: move card ---
    if (drag.type === "employee-day-card" && drop.type === "day-column") {
      const card = data.cards.find((c) => c.id === drag.card_id);
      if (!card || card.roster_date === drop.date) return;

      const previousCards = data.cards;
      // Optimistic: update roster_date AND flip status to 'changed' if
      // currently published (server does the same; we mirror locally so the
      // amber 'changed' indicator shows up instantly).
      setData((d) => ({
        ...d,
        cards: d.cards.map((c) =>
          c.id === drag.card_id
            ? {
                ...c,
                roster_date: drop.date,
                status: c.status === "published" ? "changed" : c.status,
              }
            : c,
        ),
      }));

      startTransition(async () => {
        const res = await moveEmployeeDayCard({
          card_id: drag.card_id,
          new_roster_date: drop.date,
        });
        if (!res.ok) {
          setData((d) => ({ ...d, cards: previousCards }));
          toast.error(res.error);
        } else if (res.data) {
          // Reconcile with server's authoritative row (esp. status flips).
          setData((d) => ({
            ...d,
            cards: d.cards.map((c) =>
              c.id === drag.card_id ? (res.data as EmployeeDayCardRow) : c,
            ),
          }));
        }
      });
      return;
    }

    // --- roster-assignment → employee-day-card: move assignment ---
    if (
      drag.type === "roster-assignment" &&
      drop.type === "employee-day-card"
    ) {
      if (drop.card_id === drag.employee_day_card_id) return;

      const previousAssignments = data.assignments;
      setData((d) => ({
        ...d,
        assignments: d.assignments.map((a) =>
          a.id === drag.assignment_id
            ? {
                ...a,
                employee_day_card_id: drop.card_id,
                status: a.status === "published" ? "changed" : a.status,
              }
            : a,
        ),
      }));

      startTransition(async () => {
        const res = await moveRosterAssignment({
          assignment_id: drag.assignment_id,
          new_employee_day_card_id: drop.card_id,
        });
        if (!res.ok) {
          setData((d) => ({ ...d, assignments: previousAssignments }));
          toast.error(res.error);
        } else if (res.data) {
          setData((d) => ({
            ...d,
            assignments: d.assignments.map((a) =>
              a.id === drag.assignment_id
                ? (res.data as RosterAssignmentRow)
                : a,
            ),
          }));
        }
      });
      return;
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <RosterHeader
        weekStart={weekStart}
        weekEnd={weekEnd}
        onPublishApplied={handlePublishApplied}
      />
      <div className="flex flex-1 min-h-0 gap-4 px-6 pb-6">
        <aside className="w-64 shrink-0 rounded-lg border border-gray-100 bg-background overflow-hidden">
          <SidePanel
            employees={rosterableEmployees}
            projects={visibleProjects}
            otherItems={otherItems}
          />
        </aside>

        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex gap-3 min-w-fit">
            {weekDates.map((date) => (
              <DayColumn
                key={date}
                date={date}
                cards={cardsByDate.get(date) ?? []}
                assignmentsByCard={assignmentsByCard}
                employeesById={employeesById}
                projectsById={projectsById}
                otherItemsById={otherItemsById}
                onDeleteCard={handleDeleteCard}
                onDeleteAssignment={handleDeleteAssignment}
                onAddAll={handleAddAll}
                onOpenCard={handleOpenCard}
                onOpenAssignment={handleOpenAssignment}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag && <DragPreview data={activeDrag} />}
      </DragOverlay>

      <SplitTimeDialog
        state={splitPrompt}
        onConfirm={handleSplitConfirm}
        onCancel={() => setSplitPrompt(null)}
      />

      <DetailsSheet
        state={details}
        onClose={() => setDetails(null)}
        onCardSaved={handleCardSaved}
        onAssignmentSaved={handleAssignmentSaved}
      />
    </DndContext>
  );
}
