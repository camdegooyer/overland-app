# Building a Construction Rostering App with Claude Code — Build Guide

A working write-up of how this rostering feature was built inside `overland-app`,
intended for others wanting to adapt the patterns to their own AI-assisted
projects. Covers architecture, data model, frontend patterns, the collaboration
workflow with Claude Code, migration discipline, and the design calls that
shaped it.

Total build time, end to end: roughly two working days of conversational
collaboration. ~25 migrations, ~30 components, ~15 server actions, four
distinct calendar views, polymorphic assignment model, publish workflow with
status flipping, per-day defaults, per-employee notification toggle.

This document is not a tutorial in the step-by-step sense. It's a tour of
what's there and why, plus the meta-patterns that made the collaboration
productive.

---

## Table of contents

1. [What we built](#what-we-built)
2. [Stack](#stack)
3. [Working with Claude Code: the meta-workflow](#working-with-claude-code-the-meta-workflow)
4. [Architecture overview](#architecture-overview)
5. [Data model](#data-model)
6. [Frontend patterns](#frontend-patterns)
7. [Feature deep dives](#feature-deep-dives)
   - [Drag and drop with optimistic state](#drag-and-drop-with-optimistic-state)
   - [Publish workflow: draft → published → changed](#publish-workflow-draft--published--changed)
   - [Polymorphic assignments (projects + other items)](#polymorphic-assignments-projects--other-items)
   - [Per-day defaults](#per-day-defaults)
   - [The DetailsSheet (click-to-edit)](#the-detailssheet-click-to-edit)
   - [The four read-only views](#the-four-read-only-views)
   - [Click vs drag UX](#click-vs-drag-ux)
8. [Migration discipline](#migration-discipline)
9. [Lessons, gotchas, and what I'd do differently](#lessons-gotchas-and-what-id-do-differently)
10. [Deferred features and why](#deferred-features-and-why)
11. [Adapting this to your own project](#adapting-this-to-your-own-project)

---

## What we built

A drag-and-drop construction roster for a building company's field crew.
Managers see a week (or day, by-job, month, notes) view of who's working
where, drag employees into days, drag jobs onto employee cards, edit times
and notes, mark shifts as published. Employees later receive email
notifications. Everything's persisted in Supabase.

The feature lives inside a larger Next.js workspace app at `/team/roster`,
sharing magic-link auth, sidebar nav, and the underlying `projects` /
`employees` / `contacts` data with the rest of the workspace.

The non-obvious thing: there are seven "Other" items (Leave, RDO, Public
Holiday, Staff Meeting, Training / PD, Workshop, BGAS) that aren't real
jobs but get dropped onto employee days the same way. Originally these
lived in the `projects` table with a `roster_only` flag (a hangover from
Airtable migration); we cleaned that up mid-build with a polymorphic
assignment model.

---

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind 4, Turbopack)
- **Supabase** Cloud (Sydney region) — Postgres + Auth + Edge Functions
- **`@supabase/ssr`** + service-role admin client for select RLS-bypass paths
- **dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable`) for drag/drop
- **shadcn/ui** components (Sheet, Dialog, DropdownMenu, Table, Switch, Tabs, Form, Input, Label, Select, Textarea, Sonner) — built on Base UI primitives
- **TanStack Query** (installed but not heavily used yet — server actions + `router.refresh()` + local optimistic state cover most flows)
- **date-fns** + `date-fns-tz` — all dates handled in Australia/Melbourne
- **zod** for input validation in server actions
- **lucide-react** icons
- **sonner** toasts

Deployment: Vercel (auto-deploy on push to `main`) → `app.overlandbuilders.com.au`.

---

## Working with Claude Code: the meta-workflow

This is arguably the most adaptable part of this guide. The build cadence that
worked:

### The four-step loop

```
  ┌────────────┐
  │ Brainstorm │  Free-form discussion. Claude proposes architecture
  └──────┬─────┘  options + trade-offs. User picks direction.
         │
         ▼
  ┌────────────┐
  │    Plan    │  Claude writes a structured plan doc (docs/roster-plan.md)
  └──────┬─────┘  or updates one. User reviews, redirects if needed.
         │
         ▼
  ┌────────────┐
  │  Migrate   │  DB changes go through a migration file. ALWAYS local first.
  └──────┬─────┘  User explicitly authorizes each `supabase db push`.
         │
         ▼
  ┌────────────┐
  │   Build    │  Server actions, queries, components, wiring. Lint + build
  └──────┬─────┘  passes per change.
         │
         ▼
  ┌────────────┐
  │   Review   │  User runs it. Reports back: bugs, polish, new asks. Loop.
  └────────────┘
```

### What made it work

- **Persistent memory.** Claude has a file-based memory system at
  `~/.claude/projects/<project>/memory/` storing project context, design
  decisions, user preferences. New sessions resume mid-stream without
  re-explaining.
- **Per-feature plan docs.** `docs/roster-plan.md` was written before any
  code. Captured architectural decisions, data model, phase breakdown.
  Updated as decisions changed. Served as the source of truth when sessions
  got long enough to compress earlier context.
- **Explicit confirmation on destructive ops.** Saved memory rule:
  *"always confirm before any write to Supabase Cloud."* Claude never pushed
  a migration without the user typing "push it" (or equivalent). Cloud DB
  state stays user-controlled. Local file work stays free-flowing.
- **Tight feedback loops on UI.** User would run the dev server, click
  around, dictate what felt off ("cursor's a hand when it should be a
  pointer", "borders too pale to distinguish dashed vs solid", "month
  context missing from the day headers"). Claude would diagnose, propose,
  edit, lint, report. No "let me think about this for half a day."
- **Lint + build as a constant pulse.** Every meaningful change ran through
  `npm run lint` and often `npm run build`. ESLint caught a class of React
  bugs (the `react-hooks/set-state-in-effect` rule fired twice — both real
  antipatterns) that would otherwise have shipped silently.
- **Small, focused PRs in the conversation.** Each user message turned into
  a focused block of 2–5 file edits + lint + build + report. Large
  refactors got split into stages with builds in between.

### What didn't work as well

- **Initial over-planning.** The first `docs/roster-plan.md` was extensive
  (561 lines). About 70% of it remained correct; the rest got reshaped by
  reality. Plan documents are useful when they capture decisions, less so
  when they pre-specify implementation details that will inevitably change.
- **Memory drift.** Memory entries said "planning complete, no code written
  yet" when in fact a previous session had built ~80% of Phase 4. Lesson:
  update memory at the end of significant build sessions, not just at
  decision points.

---

## Architecture overview

```
┌──────────────────────────────────────────────────────────────┐
│                       Browser                                │
│  Next.js client components: drag/drop, optimistic UI,        │
│  forms, toasts. dnd-kit, shadcn/ui, TanStack Query.          │
└────────────────────┬─────────────────────────────────────────┘
                     │  Server Actions ("use server")
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                  Next.js Server                              │
│  - Server components fetch initial page data via Supabase    │
│  - Server actions handle mutations (insert, update, delete)  │
│  - Action handlers: validate (zod) → DB write → audit → toast│
└─┬────────────────────────────────────┬───────────────────────┘
  │ user-scoped Supabase client         │ admin Supabase client
  │ (anon key + session cookie)         │ (service role)
  ▼                                     ▼
┌─────────────────────────┐  ┌────────────────────────────────┐
│   Public tables         │  │  Sensitive base tables         │
│  (RLS allows authed)    │  │  (service-role only)           │
│  - employee_day_cards   │  │  - employees (TFN, bank, DOB)  │
│  - roster_assignments   │  │  - projects (financials)       │
│  - project_roster_meta  │  │                                │
│  - roster_other_items   │  │  Exposed via safe VIEWS:       │
│  - roster_settings      │  │  - roster_employees            │
│  - roster_day_defaults  │  │  - roster_projects             │
│  - roster_audit_events  │  │                                │
└─────────────────────────┘  └────────────────────────────────┘
```

### Key separation: base tables vs views

The `employees` and `projects` tables hold sensitive data — TFN, bank
accounts, DOB on employees; contract values, financial dates, owner contacts
on projects. Those tables stay locked to `service_role` only. Two views
expose the safe subset to authenticated users:

- `public.roster_employees` — name, trade, sort order, `is_roster_employee`,
  `notify_enabled`, `is_active`. No HR fields.
- `public.roster_projects` — `project_id`, `job_code`, `suburb`, `stage`,
  `derived_label` (computed), plus `project_roster_meta` fields (colour,
  show_in_side_panel, defaults). No financial fields.

The roster app only ever queries the views. The base tables are written to
via service-role server actions (`lib/supabase/admin.ts`) gated by
`requireRole('team')`.

### Auth model

Single magic-link sign-in (no passwords). The same `/login` form for
everyone. Server-side role detection in `lib/auth/role.ts` maps
`auth.user.email` → `public.contacts.email` → presence in `employees` (=
team role) or `project_owners` (= client role). Team beats client if both
match. `requireRole('team')` is the page-level / action-level guard.

---

## Data model

The core roster tables are conceptually simple: each row in
`employee_day_cards` is a single employee on a single date with a
start/finish time. Each row in `roster_assignments` is a chunk of work that
employee does that day — either a project assignment or an "other" item
(Leave, RDO, etc.).

### Tables

```sql
-- An employee's day on the roster. One row per (employee_id, roster_date).
create table public.employee_day_cards (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees(id) on delete cascade,
  roster_date     date not null,
  start_time      time not null,
  finish_time     time not null,
  card_notes      text,
  status          text not null default 'draft'
                  check (status in ('draft','published','changed','completed','cancelled')),
  sort_order      int  not null default 0,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (employee_id, roster_date)
);

-- A chunk of work on a card. Polymorphic: either project_id OR other_item_id.
create table public.roster_assignments (
  id                      uuid primary key default gen_random_uuid(),
  employee_day_card_id    uuid not null references public.employee_day_cards(id) on delete cascade,
  project_id              uuid references public.projects(id) on delete restrict,
  other_item_id           uuid references public.roster_other_items(id) on delete restrict,
  start_time              time not null,
  finish_time             time not null,
  area                    text,
  notes                   text,
  status                  text not null default 'draft'
                          check (status in ('draft','published','changed','completed','cancelled')),
  sort_order              int  not null default 0,
  -- exactly one of project_id / other_item_id must be set
  check (
    (project_id is not null and other_item_id is null)
    or
    (project_id is null and other_item_id is not null)
  )
);

-- Reusable items: Leave, RDO, Public Holiday, Staff Meeting, Training/PD, Workshop, BGAS.
create table public.roster_other_items (
  id              uuid primary key default gen_random_uuid(),
  label           text not null unique,
  colour          text not null default '#9c9c9c',
  sort_order      integer not null default 0,
  is_active       boolean not null default true
);

-- Roster-only metadata on projects (kept separate to keep projects table lean).
create table public.project_roster_meta (
  project_id          uuid primary key references public.projects(id) on delete cascade,
  show_in_side_panel  boolean not null default false,
  colour              text not null default '#f96900',
  default_start_time  time,
  default_finish_time time,
  sort_order          integer not null default 0,
  notes               text
);

-- Single-row global settings + per-day defaults.
create table public.roster_settings (
  id                          int primary key default 1 check (id = 1),
  default_start_time          time not null default '07:30',
  default_finish_time         time not null default '16:30',
  default_break_minutes       int  not null default 30,
  default_split_start_time    time not null default '12:30',
  week_starts_on              int  not null default 1,    -- ISO: 1=Mon
  show_weekends               boolean not null default false
);
insert into public.roster_settings (id) values (1);

create table public.roster_day_defaults (
  day_of_week    integer primary key check (day_of_week between 1 and 7),
  start_time     time not null,
  finish_time    time not null,
  check (finish_time > start_time)
);
-- Seeded with 7 rows from global defaults on creation.

-- Mutation audit trail. Written via service-role from server actions.
create table public.roster_audit_events (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users(id),
  entity_type  text not null,
  entity_id    uuid not null,
  action       text not null,   -- 'create' | 'update' | 'delete' | 'move'
  before_data  jsonb,
  after_data   jsonb,
  created_at   timestamptz not null default now()
);
```

### Views

```sql
-- Safe-fields view of employees + contacts.
create view public.roster_employees as
select
  e.id, e.contact_id,
  c.first_name, c.last_name, c.preferred_name,
  coalesce(nullif(c.preferred_name, ''), c.first_name) as display_first_name,
  e.trade, e.is_roster_employee, e.roster_sort_order,
  (e.date_employment_ended is null) as is_active,
  e.notify_enabled
from public.employees e
join public.contacts c on c.id = e.contact_id;

grant select on public.roster_employees to authenticated;

-- Safe-fields view of projects + their roster meta.
create view public.roster_projects as
select
  p.id as project_id, p.job_code, p.suburb, p.street_address, p.stage,
  prm.display_name,
  coalesce(
    prm.display_name,
    case when p.suburb is not null and length(trim(p.suburb)) > 0
         then p.job_code || ' · ' || p.suburb
         else p.job_code end
  ) as derived_label,
  coalesce(prm.show_in_side_panel, false) as show_in_side_panel,
  coalesce(prm.colour, '#f96900') as colour,
  prm.default_start_time, prm.default_finish_time,
  coalesce(prm.sort_order, 0) as sort_order,
  prm.notes as roster_notes
from public.projects p
left join public.project_roster_meta prm on prm.project_id = p.id;

grant select on public.roster_projects to authenticated;
```

### Why this shape

- **Cards and assignments are separate** so a single employee-day can have
  multiple jobs without duplicating the employee-day context (notes, status,
  default times).
- **Polymorphic assignment** via two nullable FKs + a CHECK constraint is
  cleaner than a discriminator pattern (`assignable_type` + `assignable_id`)
  for two specific cases. Adding a third type would push toward a more
  generic approach.
- **`project_roster_meta` sidecar** keeps roster-specific noise off the
  `projects` table. Roster colour, show-in-side-panel toggle, default times
  don't belong on the financial-system source of truth.
- **`roster_audit_events` written via service role only.** Users can SELECT
  but not INSERT/UPDATE/DELETE. All audit writes go through `logAudit()` /
  `logAuditBatch()` server-side helpers so attribution stays consistent.

### Patterns worth stealing

- **Always-views-for-reads, base-tables-for-writes-via-admin-client.** If
  any column is sensitive, the base table gets `service_role only` RLS and
  a view exposes the safe subset. Users never see the raw base table.
- **Single-row settings tables** with `check (id = 1)` constraint. Cleaner
  than EAV or JSONB for known-shape config.
- **Sidecar tables for module-specific fields.** Don't sprawl the core
  domain table; add a 1:1 sidecar.
- **Audit log as append-only**, written from server actions next to the
  mutation, not from triggers. Triggers fire on seeds and migrations
  unexpectedly; server-side keeps attribution clean.

---

## Frontend patterns

### Server components fetch, client components mutate

The page-level `app/team/roster/page.tsx` is a server component:

```tsx
export default async function RosterWeek({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  await requireRole("team");
  const { week } = await searchParams;
  const anchor = week ?? todayISO();

  const settings = await getRosterSettings();
  const weekDates = getWeekDates(anchor, settings.week_starts_on, settings.show_weekends);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[weekDates.length - 1];

  const [rosterable, allEmployees, visibleProjects, allProjects, otherItems, weekData] =
    await Promise.all([
      getRosterableEmployees(),
      getRosterEmployees(),
      getRosterProjects({ visibleOnly: true }),
      getRosterProjects(),
      getRosterOtherItems({ activeOnly: true }),
      getWeekRosterData(weekStart, weekEnd),
    ]);

  return (
    <RosterBoard
      key={weekStart}
      weekDates={weekDates}
      weekStart={weekStart} weekEnd={weekEnd}
      initialData={weekData}
      rosterableEmployees={rosterable}
      allEmployees={allEmployees}
      visibleProjects={visibleProjects}
      allProjects={allProjects}
      otherItems={otherItems}
      settings={settings}
    />
  );
}
```

No `useEffect`-fetch, no client-side data fetching on initial render. Server
fetches in parallel via `Promise.all`, passes everything as props. The
`<RosterBoard>` is a client component that holds local state for optimistic
drag-drop updates.

### Server actions (`"use server"`)

Mutations are always server actions, never client-side Supabase calls.
Pattern:

```ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/roster/audit";

const Input = z.object({
  employee_day_card_id: z.string().uuid(),
  // ...
});

export async function createRosterAssignment(raw: z.infer<typeof Input>) {
  await requireRole("team");                      // 1. auth gate
  const input = Input.parse(raw);                 // 2. validate (throws on bad input)

  const supabase = await createClient();          // 3. user-scoped client (RLS applies)

  const { data, error } = await supabase
    .from("roster_assignments")
    .insert({ /* ... */ })
    .select()
    .single();

  if (error) return { ok: false as const, error: error.message };

  await logAudit({                                // 4. audit (admin client, separate concern)
    entity_type: "roster_assignment",
    entity_id: data.id,
    action: "create",
    after: data,
  });

  revalidatePath("/team/roster");                 // 5. invalidate cached page data
  return { ok: true as const, data };
}
```

Every action returns a discriminated union `{ ok: true, data } | { ok:
false, error }`. Client uses the result for optimistic rollback + toast.

### Optimistic UI with local state + server reconciliation

Drag/drop fires before the server roundtrip:

```tsx
function createAssignmentOptimistic(args: {...}) {
  const optimisticId = tempId("assign");
  const optimistic: RosterAssignmentRow = {
    id: optimisticId,
    /* ... synthetic row with `temp-` prefix id */
  };
  setData((d) => ({ ...d, assignments: [...d.assignments, optimistic] }));

  startTransition(async () => {
    const res = await createRosterAssignment({ /* ... */ });
    if (!res.ok) {
      setData((d) => ({ ...d, assignments: d.assignments.filter((a) => a.id !== optimisticId) }));
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
```

Three states for each row:
1. **Optimistic** (`id.startsWith("temp-")`) — visible immediately, drag/click disabled, slight pulse animation
2. **Real** — once server returns the persisted row with its real UUID
3. **Rolled back** — on server error, removed from local state, toast shown

The drag handlers don't await the server; they kick off the action and let
the UI proceed. If many quick drags happen, they pipeline through React's
`useTransition` queue.

### Reset state across navigations: `key={X}`

A subtle React/Next antipattern caught by the `react-hooks/set-state-in-effect`
ESLint rule:

```tsx
// BAD: setState-in-effect, fires cascading renders
useEffect(() => {
  setData(initialData);
}, [initialData]);
```

The correct fix is to reset state via a `key` prop on the component:

```tsx
// page.tsx
<RosterBoard key={weekStart} initialData={weekData} ... />
```

When `weekStart` changes (user navigates between weeks), React unmounts and
remounts `RosterBoard`, getting fresh state derived from the new
`initialData`. No effect, no cascading renders.

For the DetailsSheet which needs form state reset when targeting a different
row, we use the same pattern: outer `<Sheet>` shell stays mounted for the
animation, inner `<DetailsForm key={state.kind === 'card' ? 'card:' + state.card.id : 'assignment:' + state.assignment.id}>` remounts on target change.

### Server-action results need to also patch local state

The publish action revalidates the page data, but the `<RosterBoard>` holds
local state that doesn't auto-sync on revalidation (the whole point of
local state for optimistic UI). So the publish action returns the affected
row IDs, and the client patches local state to flip status to `published`:

```ts
const res = await publishUnpublishedInRange({ week_start, week_end });
if (res.ok) {
  onPublishApplied?.({ cardIds: res.cardIds, assignmentIds: res.assignmentIds });
}
```

This is the rule: **any server-side state change that needs to show in the
UI must be communicated back to the client either via returned data (for
optimistic patches) or via a `router.refresh()` + key-reset (for full
re-fetch).** The cache-revalidation alone isn't enough when local state is
the source of truth for the rendered DOM.

### Forms with shadcn/ui

Two patterns coexist:

1. **Direct controlled inputs** — for simple settings forms. Each field has
   its own `useState`, submit handler bundles them into the server action
   input.
2. **Inline-edit-on-blur tables** — for the employees and jobs admin tables.
   Each row tracks its own draft values; `onBlur` fires the server action
   if the value differs from the original. Toast on success/failure with
   `duration: 1200ms` so the user sees feedback without it lingering.

`react-hook-form` is installed but not yet used; the forms are simple
enough that direct state is cleaner.

---

## Feature deep dives

### Drag and drop with optimistic state

dnd-kit is the chosen library. The pattern:

- Each draggable source has `useDraggable({ id, data })` where `data` is a
  discriminated-union `DragData` object
- Each drop target has `useDroppable({ id, data })` where `data` is a
  discriminated-union `DropData` object
- A single `DndContext` wraps the board; `onDragEnd` dispatches on the
  cartesian product of drag.type × drop.type

```ts
type DragData =
  | { type: "employee-source"; employee_id: string; display_name: string }
  | { type: "job-source"; project_id: string; display_name: string }
  | { type: "other-source"; other_item_id: string; display_name: string }
  | { type: "employee-day-card"; card_id: string; employee_id: string; display_name: string }
  | { type: "roster-assignment"; assignment_id: string; project_id: string | null;
      other_item_id: string | null; employee_day_card_id: string; display_name: string };

type DropData =
  | { type: "day-column"; date: string }
  | { type: "employee-day-card"; card_id: string; roster_date: string };
```

`onDragEnd` reads both data payloads from the event and dispatches:

```ts
function onDragEnd(event: DragEndEvent) {
  setActiveDrag(null);
  const drag = event.active.data.current as DragData | undefined;
  const drop = event.over?.data.current as DropData | undefined;
  if (!drag || !drop) return;

  if (drag.type === "employee-source" && drop.type === "day-column") {
    // create card
  } else if (drag.type === "job-source" && drop.type === "employee-day-card") {
    // create assignment (with split-time prompt if 2nd+ assignment)
  } else if (drag.type === "other-source" && drop.type === "employee-day-card") {
    // create other-item assignment
  } else if (drag.type === "employee-day-card" && drop.type === "day-column") {
    // move card to different day
  } else if (drag.type === "roster-assignment" && drop.type === "employee-day-card") {
    // move assignment to different card
  }
}
```

### Sensor configuration

```ts
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
);
```

`distance: 6` means dnd-kit won't start a drag until the pointer moves at
least 6px. This lets a tap-without-movement fire `onClick` (used for
opening the DetailsSheet) without triggering a drag.

### Drag preview / overlay

```tsx
<DragOverlay dropAnimation={null}>
  {activeDrag && <DragPreview data={activeDrag} />}
</DragOverlay>
```

`dropAnimation={null}` disables the default snap-back animation. Without
this, the drag preview animates back to its origin on drop, which looked
deceiving ("did it work?"). Disabling makes the preview disappear at the
drop point cleanly.

### Split drag handle from click region

A polish detail with big UX impact. The original setup had drag listeners
on the entire card header AND a click handler — confusing cursor (grab
everywhere, but it also opened a sheet on click).

The fix: move listeners onto a small grip icon only. Rest of the header
gets `cursor-pointer` and `onClick`.

```tsx
<div onClick={() => onOpenCard(card)} className="flex items-center gap-2 cursor-pointer">
  <span
    {...listeners}
    {...attributes}
    className="cursor-grab active:cursor-grabbing"
    onClick={(e) => e.stopPropagation()}    // grip click ≠ card click
    aria-label="Drag handle"
  >
    <GripVertical />
  </span>
  <div className="flex-1 min-w-0 font-medium truncate">{name}</div>
</div>
```

Cursor matches intent: grab on the grip, pointer on the body. `e.stopPropagation()` on the grip's onClick prevents the card's open handler firing when the grip is clicked.

### Publish workflow: draft → published → changed

Every card/assignment has a status: `draft | published | changed | completed | cancelled`. The flow:

1. **New row** = `draft`. Visual: dashed grey border.
2. **Click Publish** → all draft rows in the visible week become `published`.
   Visual: solid grey border.
3. **Edit a published row** → server action auto-flips status to `changed`.
   Visual: solid grey border + small amber dot.
4. **Click Publish again** → changed rows flip back to `published`. Amber
   dot disappears.

The auto-flip is the key: it lives in `updateEmployeeDayCard` and
`updateRosterAssignment`:

```ts
const beforeStatus = (before as { status?: string } | null)?.status;
if (beforeStatus === "published" && !("status" in input)) {
  patch.status = "changed";
}
```

The `!("status" in input)` guard means the publish action itself (which
explicitly sets `status: "published"`) doesn't get re-flipped.

#### Split publish button

A shadcn `DropdownMenu` next to the main Publish button gives two actions:

- **Publish unpublished** (default click) → only `draft` and `changed` rows
- **Republish everything** (dropdown item) → all rows in the range

Reason for both: when notifications are wired, "republish everything"
re-notifies all employees regardless of whether their shifts changed,
useful as a "make sure they got the message" backstop.

#### What "publish" actually means (today vs future)

Today it's purely a status flag — the visual indicator tells the manager
which shifts they've committed. Email/SMS notification is the planned next
step (Twilio deferred in favour of Gmail; Gmail OAuth has the wrong scope
currently and needs to be re-authorized with `gmail.send` added).

### Polymorphic assignments (projects + other items)

Originally, the 7 "Other" items (Leave, RDO, etc.) lived in `public.projects`
with a `roster_only` flag — a hangover from an Airtable migration. The
problem: those rows had no contract value, no owner, no enquiry — they
existed only to be draggable into a roster. Polluting the projects table.

The fix: a dedicated `roster_other_items` table + a polymorphic
`roster_assignments` table.

```sql
alter table public.roster_assignments
  add column other_item_id uuid references roster_other_items(id) on delete restrict;

alter table public.roster_assignments
  alter column project_id drop not null;

alter table public.roster_assignments
  add constraint roster_assignments_target_xor
  check (
    (project_id is not null and other_item_id is null)
    or
    (project_id is null and other_item_id is not null)
  );

-- Then: migrate existing assignments referencing the 7 fake projects, then
-- delete the 7 fake project rows.
```

The data-migration step matched on the stable Airtable `airtable_record_id`
to map old project rows → new other_items rows:

```sql
with airtable_to_label(airtable_record_id, label) as (
  values
    ('recKJywHgOCCfKL4V', 'Leave'),
    ('rec4P9q1WjTJP04xE', 'Public Holiday'),
    ('recFxnyiHCtUr4xcn', 'RDO'),
    -- ...
),
mapping as (
  select p.id as old_project_id, o.id as new_other_id
  from airtable_to_label atl
  join public.projects p on p.airtable_record_id = atl.airtable_record_id
  join public.roster_other_items o on o.label = atl.label
)
update public.roster_assignments ra
set project_id = null, other_item_id = m.new_other_id
from mapping m
where ra.project_id = m.old_project_id;
```

Then the `projects.roster_only` column got dropped in a follow-up migration
(which had to `DROP VIEW roster_projects` first because the view referenced
the column, then recreate the view without the filter).

#### Why polymorphic over discriminator

Two nullable FKs + CHECK is more SQL-native than a `(target_id,
target_type)` discriminator. PostgreSQL can foreign-key-validate each FK
independently. Querying is also more natural: `WHERE project_id = ?` works
without needing to also filter on `target_type = 'project'`.

The downside: adding a third type (say `internal_task_id` later) means
another column + a more complex CHECK. At three+ types, a discriminator
starts winning. Two types: polymorphic is cleaner.

### Per-day defaults

Original setup had two global defaults: `roster_settings.default_start_time` and `default_finish_time`. Reality: builders want different times on different
weekdays — shorter Fridays, etc.

New table:

```sql
create table public.roster_day_defaults (
  day_of_week    integer primary key check (day_of_week between 1 and 7),
  start_time     time not null,
  finish_time    time not null,
  check (finish_time > start_time)
);

-- Seeded with 7 rows from the existing global defaults so behaviour is
-- unchanged until a manager edits them.
insert into public.roster_day_defaults (day_of_week, start_time, finish_time)
select dow, s.default_start_time, s.default_finish_time
from public.roster_settings s
cross join generate_series(1, 7) as dow
where s.id = 1;
```

Lookup helper in the create-card server actions:

```ts
async function resolveDayDefaults(dateISO: string) {
  const [settings, dayDefaults] = await Promise.all([
    getRosterSettings(),
    getRosterDayDefaults(),
  ]);
  const dow = isoDayOfWeek(dateISO);
  const match = dayDefaults.find((d) => d.day_of_week === dow);
  return {
    start_time: match?.start_time ?? settings.default_start_time,
    finish_time: match?.finish_time ?? settings.default_finish_time,
  };
}
```

The global defaults stay as a fallback. If a day_defaults row ever goes
missing (shouldn't, given the seed), the action still works.

UI: 7-row table in `/team/settings/roster`. Each row has start/finish time
inputs. Double-clicking a cell copies its value to all other days (quick
"set Mon-Fri to same hours" gesture).

### The DetailsSheet (click-to-edit)

A slide-in right-side sheet for editing cards or assignments. Built on
shadcn `Sheet` (which wraps Base UI `Dialog`).

Two modes via discriminated union:

```ts
export type DetailsSheetState =
  | { kind: "card"; card: EmployeeDayCardRow; employee: RosterEmployee | undefined }
  | {
      kind: "assignment";
      assignment: RosterAssignmentRow;
      project: RosterProject | undefined;
      otherItem: RosterOtherItem | undefined;
    }
  | null;
```

Shell + form split so the form remounts cleanly when the user clicks a
different row mid-edit:

```tsx
export function DetailsSheet({ state, onClose, onCardSaved, onAssignmentSaved }: Props) {
  return (
    <Sheet open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {state && (
          <DetailsForm
            key={state.kind === "card"
              ? `card:${state.card.id}`
              : `assignment:${state.assignment.id}`}
            state={state}
            onClose={onClose}
            onCardSaved={onCardSaved}
            onAssignmentSaved={onAssignmentSaved}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
```

The form has start/finish time inputs, an optional Area input (only for
project assignments), and a Notes textarea. Save calls the appropriate
update server action (`updateEmployeeDayCard` or `updateRosterAssignment`)
and patches local state in `RosterBoard` via the `onCardSaved` /
`onAssignmentSaved` callbacks.

### The four read-only views

Beyond the editable Week view, four read-only views show the same data
differently:

- **Day** (`/team/roster/day?d=YYYY-MM-DD`) — vertical list of employee
  blocks for one day; each block shows the employee + their time + a list
  of their jobs/items with times, areas, notes.
- **By Job** (`/team/roster/by-job?week=YYYY-MM-DD`) — same week range,
  rows are jobs/items, columns are days, cells list employees on that job
  that day. Sticky header row.
- **Notes** (`/team/roster/notes?week=YYYY-MM-DD`) — flat list of every
  card with `card_notes` plus every assignment with `notes` in the week.
- **Month** (`/team/roster/month?m=YYYY-MM-DD`) — calendar grid (rows =
  weeks, columns = days). Each cell shows employee count + top 3 job/item
  labels.

All four are intentionally read-only. Clicking anywhere navigates to the
Week view at that date, where editing happens. Keeps the surface small —
mutation code stays in one place.

Shared chrome:

- `<RosterTabs active="day|by-job|month|notes|week">` — view-tab nav,
  reusable across all five views.
- `<ReadOnlyViewHeader>` — title + prev/today/next nav + tabs. Used by all
  four read-only views.
- `<RosterHeader>` (Week view only) — adds the split-publish button on top
  of the shared shell.

### Click vs drag UX

Three lessons here, each painful in isolation:

1. **Drag listeners on the whole card + onClick on the whole card = confusing cursor.** Initially everything was `cursor-grab` but click did open-sheet. Fix: split — grip icon gets `cursor-grab` + listeners, body gets `cursor-pointer` + `onClick`.
2. **`activationConstraint: { distance: 6 }`** is essential. Without it, even a tap fires a drag, never a click.
3. **Drop animation = visual lie**. `dropAnimation={null}` on `DragOverlay`. The drag preview should disappear at the drop point, not snap back to the source (which looks like the drop failed).

---

## Migration discipline

The rule, encoded as a saved Claude memory:

> **Always confirm before any write to Supabase Cloud (migrations, seeds,
> ad-hoc). Local file work is fine.**

In practice:

1. Claude writes the migration file at
   `08_systems/supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql`.
2. Claude shows the user what the migration does.
3. User reads, asks questions if needed, says "push it" (or equivalent).
4. Claude runs `supabase db push`.

Auto-classifier blocks even attempted pushes without explicit authorization
in the conversation. This rule has caught real intent gaps multiple times.

### Naming convention

`YYYYMMDDHHMMSS_descriptive_name.sql`. Example:
`20260516160000_roster_phase2.sql`. Lexical sort order matches chronological
order. Use distinct hours/minutes/seconds when multiple migrations land the
same day to keep ordering unambiguous.

### Migration anatomy

Every migration starts with a comment block explaining:
- What this changes
- Why (link back to a doc, conversation, or incident if relevant)
- Any cleanup steps (drops, data migrations)

```sql
-- =============================================================================
-- Migration: per-day roster defaults + small trade-field cleanup
-- =============================================================================
-- Two things in one file:
--
-- 1. Clears stray 'sss' values from employees.trade. These were entered as
--    test data via the old Employees admin (Trade column has since been
--    removed). Idempotent — `WHERE trade = 'sss'` makes this safe to re-run.
--
-- 2. Adds public.roster_day_defaults — one row per ISO day-of-week (1=Mon
--    .. 7=Sun) holding the start/finish times that should pre-fill a new
--    employee_day_card on that weekday. Seeds all 7 rows from the existing
--    global defaults so behaviour is unchanged until a manager edits them.
-- =============================================================================
```

### Idempotency where practical

Use `add column if not exists`, `create table if not exists` only when the
migration might be re-run. For brand-new tables, plain `create table`
documents intent more clearly.

Data updates use `WHERE` clauses that make them no-ops on re-run:

```sql
update public.employees set trade = null where trade = 'sss';
```

Running this twice is fine; the second time matches zero rows.

### Postgres-specific gotchas hit during this build

- **`CREATE OR REPLACE VIEW` can't change column order.** If you need to
  add a column, append it to the end of the SELECT list, don't insert it
  in the middle. Otherwise you'll get `cannot change name of view column`.
- **`ALTER TABLE DROP COLUMN` fails if a view depends on it.** Drop the
  view first, then drop the column, then recreate the view.
- **Cascading deletes work** for the polymorphic FK pattern. The 7 fake
  projects were cleanly removed because `project_roster_meta.project_id`
  had `ON DELETE CASCADE` and `roster_assignments.project_id` had `ON
  DELETE RESTRICT` (which we cleared via data migration first).

---

## Lessons, gotchas, and what I'd do differently

### Lessons

- **Plan docs are best at decisions, worst at implementations.** Capture
  why a choice was made, what was rejected, what's deferred. Don't pre-
  specify the exact prop names of components you haven't built yet.
- **Update memory at the end of build sessions.** Memory rot was the
  biggest source of friction across sessions. A two-line update like "Phase
  4 substantially complete; lint error on RosterBoard line 76 was last
  thing tried" would have saved 10 minutes of orientation in the next
  session.
- **Lint is your tripwire.** `react-hooks/set-state-in-effect` caught two
  real antipatterns (both prop→state syncs in `useEffect`) that would
  otherwise have shipped subtle re-render bugs. Don't disable lint rules
  to make builds pass; fix the underlying pattern.
- **Read-only views are cheap and high-value.** The four read-only views
  (Day, By Job, Month, Notes) each took ~30 minutes after the shared
  infrastructure was in place. They give the manager four different
  perspectives on the same data without re-implementing mutation logic.
- **Optimistic updates feel instant; revalidation feels broken.** When the
  user clicks a button and sees the UI change immediately, they trust it.
  When they have to wait 500ms for the page to revalidate and then see the
  change, they think it didn't work. Always patch local state first.
- **Brainstorm-then-build outperforms code-first.** Multiple times the
  user opened a feature discussion ("the publish button should…") and we
  spent 10 minutes settling decisions before any code. The code itself
  took 20 minutes once decisions were settled. Without the brainstorm,
  it would have been an hour of code + an hour of rework.

### Gotchas

- **shadcn Sheet uses Base UI Dialog, not Radix.** Some API surface
  differs from older shadcn docs. Specifically: `open`/`onOpenChange`
  works the same, but slot prop names and some compound-component shapes
  vary. Read the actual generated files.
- **Next 16 renamed `middleware.ts` to `proxy.ts`.** Old setup guides will
  steer you wrong. The file does the same job; just the name changed.
- **`next lint` is deprecated in Next 16.** Use `npm run lint` (which calls
  `eslint` directly per `package.json`).
- **Service-role client must never reach the browser.** Keep it server-only
  via the `import "server-only"` shim in `lib/supabase/admin.ts`. A leaked
  service-role key bypasses all RLS.
- **Postgres `time` type returns strings.** `"07:30:00"` from the DB,
  `"07:30"` from HTML `<input type="time">`. Normalize with a `trimSeconds`
  helper before string-comparing.
- **Lexical comparison of `HH:MM` strings works for same-day comparisons**
  (e.g., `"07:30" < "16:30"` is `true`) but breaks across midnight. Roster
  shifts don't cross midnight here, so this is fine. Don't rely on it for
  shift-work apps.

### What I'd do differently

- **Add per-employee/per-project colour pickers earlier.** Currently
  there's a colour pip on each assignment box pulled from
  `project_roster_meta.colour` (or `roster_other_items.colour`). The
  defaults are all the same neutral grey, so visually all assignments look
  the same. A first-week task should be "set 8 distinct colours for your
  active jobs."
- **Build the audit-log viewer earlier.** `roster_audit_events` is being
  populated diligently but there's no UI for it. Surfacing "who changed
  what on this shift" would help managers trust the system.
- **TanStack Query is installed but underused.** For initial page loads
  the server-fetch pattern is fine. For real-time updates (when display
  screens get built), TanStack Query + Supabase Realtime channels will be
  necessary. The current local-state approach won't scale to multi-manager
  concurrent editing.

---

## Deferred features and why

| Feature | Why deferred |
|---|---|
| Real-time updates | Single-manager use today; multi-tab sync via Supabase Realtime channels is Phase 7+ |
| Employee `/me` workspace (read-only "my shifts") | Adds an auth sub-role (`team_role: manager | staff`); deferred until the manager workflow is fully validated |
| SMS notifications via Twilio | Email-first decision (no per-message cost) |
| Email notifications via Gmail | Existing Gmail OAuth has `gmail.modify` only; needs re-authorization with `gmail.send` scope added |
| Display tokens (workshop TV screens) | Will be a thin server-rendered view with no client SDK; gated by token validation server-side |
| Drag-to-reorder side panel employees | `roster_sort_order` column exists, but UI defaults all to 0 + alphabetical secondary sort. Manual reorder is a polish item |
| Detailed "what changed" in publish emails | Needs `last_published_*` snapshot columns on cards/assignments. Designed but not built |
| Audit log viewer | Data is written; no UI yet |
| `trades` controlled vocabulary | Currently free text on `employees.trade` |
| `team_role` column on employees | Required when staff workspace lands |

---

## Adapting this to your own project

### If you're building a similar drag/drop scheduling app

The patterns that should port directly:

1. **Polymorphic assignment via two FKs + CHECK constraint** — drop right
   into any project that needs "this slot can hold either an X or a Y."
2. **Status flow with auto-flip on edit** — `draft → published → changed →
   published` is a clean model for "manager has reviewed, then edited
   later, must re-review."
3. **Per-row drag handle + body click** with `activationConstraint: { distance: 6 }` and
   `e.stopPropagation()` on the handle's click. Reads instantly to users.
4. **Shell+form split with `key={targetId}`** for sheets/dialogs that edit
   different rows. Resets form state cleanly without effects.
5. **Server actions return `{ ok: true, data } | { ok: false, error }`** —
   simple discriminated union, easy optimistic rollback.

### If you're working with Claude Code on a multi-day build

The workflow that paid off:

1. **Start with a brainstorm.** No code in the first session, or at most a
   scaffold. Generate an explicit plan document. Iterate on it.
2. **Save memory entries for durable decisions.** "User prefers polymorphic
   over discriminator." "Always confirm before Cloud DB push." "All dates
   in Australia/Melbourne." Future sessions need this context.
3. **Lint + build between feature blocks**, not at the end. Cheap signal
   that catches issues while context is fresh.
4. **Migrate first, code second.** When a feature needs new schema, write
   the migration before any TypeScript. Forces clarity on the data model
   before you've committed to a UI shape.
5. **Read-only views are cheap.** Once mutation logic is in one place,
   layering on 3-4 read-only perspectives is hours, not days.
6. **Test the UX while building, not after.** The user's "the cursor is a
   hand when it should be a pointer" came after one screen-share. The fix
   was 4 file edits. Catching it after launch would have been a multi-week
   gap.

### Suggested adaptation order (if cloning this for a new app)

1. Set up the basic Next.js + Supabase scaffold with magic-link auth and
   a single page (no roster yet).
2. Define your core domain table(s). Get RLS right from day one — base
   tables service-role-only, safe views for authenticated reads.
3. Build the editable view first (Week view here). Get drag/drop +
   optimistic state + audit working.
4. Build the read-only sibling views once mutation is settled.
5. Add the publish workflow last — once you know the editing flow, you can
   design the "commit and notify" layer over it.
6. Notifications go after publishing. Make the data layer right first.

### Open-ended takeaways

- The collaboration is more effective when both sides treat decisions as
  reversible. Claude proposes; user accepts, redirects, or asks for a
  second option. The conversation moves forward without ego.
- Memory is the killer feature. It's what makes day 2 of a build feel
  like a continuation, not a restart.
- Migration discipline is the killer constraint. Database state is shared
  reality between conversations and across humans; treat changes to it
  with care.

---

## Final notes

The roster is in production-shape but not in active production use yet. The
team's 17 field employees need their contact emails wired, the manager
needs to set `is_roster_employee` toggles, and Gmail OAuth needs the send
scope. Then it goes live.

If you build something similar and run into a wall, the patterns in this
file should be enough to get you unstuck. The plan document at
`docs/roster-plan.md` has more granular detail on specific phases. The
migrations in `08_systems/supabase/migrations/` show the schema evolution
chronologically — reading them in order is a fast way to understand the
data model.

Good luck.
