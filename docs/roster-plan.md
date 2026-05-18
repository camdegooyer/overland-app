# Roster — planning doc

Construction rostering feature integrated into `overland-app`. Day-box UX, drag/drop manager board, read-only display screens for employee phones (and later workshop TV).

Source spec: `C:\Users\cam\Downloads\claude_roster_alpha_prompt.md` ("Claude Code Master Prompt — Construction Rostering App Alpha"). This doc captures the integrated translation of that spec into our existing stack, with all design calls made during planning.

Status: **planning complete, no code written yet.**

---

## Goal

A manager-edited, employee-viewed daily roster for Overland's field crew. Drag employees into days, drag jobs onto employee cards, add per-assignment notes. Read-only display URLs for crew phones (and later a workshop TV).

Replaces nothing automated today — no existing source of truth for site rosters. WunderBuild is unrelated; no integration planned.

## In scope (alpha)

- Manager: Week / Day / By Job / Month / Notes views, all on a day-box board (no hourly timeline)
- Drag/drop: employee-source → day, job-source → employee-day-card, card → day, assignment → card
- Per-assignment notes (the key spec requirement — notes are roster-specific, not master-job notes)
- Read-only display screens: personal (one employee) + shared (group by site)
- CRUD admin pages for rosterable employees + rosterable projects + roster defaults
- Warning helpers (no job assigned, finish before start, etc.)
- Audit log of all mutations
- Supabase Realtime for live display updates

## Out of scope (alpha)

- Payroll, award interpretation, timesheets, costing
- SMS / push notifications
- Leave / unavailability tracking (no source of truth yet — deferred)
- Multi-company support (Overland is single-company; don't pay the multi-tenant complexity tax)
- Employee personal login (display tokens cover the read use case)
- WunderBuild integration

---

## Architecture decisions

| # | Decision | Why |
|---|---|---|
| 1 | Integrate into existing `overland-app` (not a standalone repo) | Reuses existing magic-link auth, existing `contacts`/`employees`/`projects` data (17 / 142 rows), existing Vercel deploy. One domain, one auth. |
| 2 | New routes under `/team/**`; sidebar layout for whole `/team` area | Sidebar nav scales as more sections are added. Roster sits next to Dashboard / Jobs / Employees / Settings. |
| 3 | UI labels say "Jobs", data layer reads `public.projects` | Cam's preference. Underlying noun stays "project" — UI label is just translation. |
| 4 | `is_roster_employee boolean` flag separate from `date_employment_ended` | "Active" (currently employed) ≠ "rosterable" (field crew you want on the board). Both filters compose. |
| 5 | `roster_employees` SQL view exposing safe employee fields to `authenticated` | Base `employees` table stays `service_role`-only (TFN, bank, DOB). View exposes name + trade + active + sort. RLS is row-level not column-level, so view is the right tool. |
| 6 | `project_roster_meta` 1:1 sidecar table for roster-only project fields (colour, default times, show_in_side_panel) | Keeps the lean `projects` CRM table free of rostering noise. |
| 7 | Manual project visibility — `show_in_side_panel` defaults false; Cam ticks what's active | Explicit, no surprises. 142 projects is too many to auto-show. |
| 8 | Display tokens have `scope` (personal/shared) + optional `employee_id` | Personal for phones (employee scans QR), shared for workshop TV. Both built from day one. |
| 9 | Laptop-primary manager UI | 1280px+ default, drag/drop tuned for mouse. Touch usable, not optimised. |
| 10 | TanStack Query + Next server actions for mutations | Server actions handle DB writes + audit log atomically; TanStack Query handles optimistic cache + Supabase Realtime cache invalidation. |
| 11 | dnd-kit for drag/drop | Spec choice. Best React DnD lib in 2026. |
| 12 | shadcn/ui for components | Spec choice. Components copied into repo, fully customisable. |
| 13 | Audit every roster mutation to `roster_audit_events` (before/after JSONB) | Simple alpha-grade audit. Full row before/after, no fancy diff. |
| 14 | Time zone: Australia/Melbourne everywhere | Spec. `roster_date` is `date`, times are `time` (no tz); display formatting always Melbourne local. |
| 15 | Last-write-wins for concurrent edits, audit captures full history | Alpha — no pessimistic locking. Two managers editing same card simultaneously is rare; if it happens, last save wins and audit log shows both. |
| 16 | All `team` role members get full roster edit access (no manager-vs-staff sub-role yet) | Alpha is single-company with ~5 actual managers. Adding `team_role enum` is deferred until field staff get accounts. Document as known limitation. |
| 17 | `logAudit` uses the service-role admin client (`lib/supabase/admin.ts`); `roster_audit_events` stays insert-blocked for `authenticated` | Prevents users from spamming audit log; keeps audit writes uniformly server-controlled. |

---

## Tech stack additions

Already installed: Next.js 16, React 19, Tailwind 4, Supabase SSR.

To add in Phase 1:
- `@dnd-kit/core`, `@dnd-kit/sortable`
- `@tanstack/react-query` + `@tanstack/react-query-devtools`
- `shadcn-ui` (init + add components as needed)
- `date-fns`, `date-fns-tz`
- `lucide-react` (icons)
- `zod`
- `react-hook-form` + `@hookform/resolvers`
- `sonner` (toast — shadcn default)

shadcn smoke test needed: confirm Tailwind 4 + React 19 + Next 16 compatibility on Phase 1.

---

## Routes

```
/                                  Landing (existing)
/login                             Magic link (existing)
/team                              Dashboard (existing, refreshed nav)
/team/roster                       Week planner — main edit view
/team/roster/day?d=YYYY-MM-DD      Day planner
/team/roster/by-job                By-job/by-site grouping
/team/roster/month                 Month overview
/team/roster/notes                 Notes-only filter
/team/jobs                         Project roster admin (show-in-panel, colour, default times)
/team/jobs/[id]                    Single project roster settings
/team/employees                    Roster employee admin (trade, is_roster_employee, sort)
/team/employees/[id]               Single employee roster settings
/team/settings/roster              Default times, week start, weekend visibility
/team/settings/display             Display tokens — generate, name, copy URL/QR, revoke

/display/today?t=<token>           Public, token-gated
/display/month?t=<token>           Public, token-gated
/portal                            Client portal (existing)
```

Note: `/team` stays as the dashboard (not `/team/dashboard`). Sidebar shows "Dashboard" as the first item pointing at `/team`.

---

## Sidebar nav (for `/team/**`)

```
┌──────────────┬──────────────────────────────────────┐
│  [LOGO]      │  / Team / Roster      Cam   Sign out │
├──────────────┼──────────────────────────────────────┤
│  Dashboard   │                                      │
│  Roster   ●  │  [Week] Day By Job Month Notes       │
│  Jobs        │                                      │
│  Employees   │  …board…                             │
│  Settings    │                                      │
└──────────────┴──────────────────────────────────────┘
```

`[LOGO]` is the existing `<Logo />` component (`app/_components/Logo.tsx`) rendering the Overland wordmark image. Single `app/team/layout.tsx` renders sidebar + header for all `/team/**` routes. Active nav item highlighted with the accent colour.

---

## Data model

All migrations land in one Phase 2 file. Existing tables (`contacts`, `employees`, `projects`, `project_owners`, etc.) unchanged except for two additive columns on `employees`.

### Changes to existing tables

**`public.employees`** — add two columns:
```sql
alter table public.employees
  add column trade text,
  add column is_roster_employee boolean not null default false,
  add column roster_sort_order integer not null default 0;
```

`trade` is free text alpha; if a controlled vocabulary is wanted later, migrate to a join table. Suggested values: 'Carpenter', 'Apprentice', 'Labourer', 'Supervisor', 'Office'.

### New view

**`public.roster_employees`** — safe-fields view for the authenticated app:
```sql
create view public.roster_employees as
  select
    e.id,
    e.contact_id,
    c.first_name,
    c.last_name,
    c.preferred_name,
    coalesce(c.preferred_name, c.first_name) as display_first_name,
    e.trade,
    e.is_roster_employee,
    e.roster_sort_order,
    (e.date_employment_ended is null) as is_active
  from public.employees e
  join public.contacts c on c.id = e.contact_id;

grant select on public.roster_employees to authenticated;
```

This is what the roster app queries. Sensitive HR fields stay locked to `service_role` via the base `employees` table RLS.

### New tables

**`public.project_roster_meta`** — 1:1 with projects:
```sql
create table public.project_roster_meta (
  project_id          uuid primary key references public.projects(id) on delete cascade,
  show_in_side_panel  boolean not null default false,
  colour              text not null default '#f96900',   -- Overland accent by default
  default_start_time  time,
  default_finish_time time,
  sort_order          integer not null default 0,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
```

**`public.roster_settings`** — single-row, single-tenant:
```sql
create table public.roster_settings (
  id                          int primary key default 1 check (id = 1),
  default_start_time          time not null default '07:30',
  default_finish_time         time not null default '16:30',
  default_break_minutes       int  not null default 30,
  default_split_start_time    time not null default '12:30',
  week_starts_on              int  not null default 1,    -- ISO: 1=Mon
  show_weekends               boolean not null default false,
  updated_at                  timestamptz not null default now()
);
insert into public.roster_settings (id) values (1);
```

**`public.employee_day_cards`** — parent card:
```sql
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
```

**`public.roster_assignments`** — child job box (spec calls these `job_assignments`):
```sql
create table public.roster_assignments (
  id                      uuid primary key default gen_random_uuid(),
  employee_day_card_id    uuid not null references public.employee_day_cards(id) on delete cascade,
  project_id              uuid not null references public.projects(id) on delete restrict,
  start_time              time not null,
  finish_time             time not null,
  area                    text,
  notes                   text,
  status                  text not null default 'draft'
                          check (status in ('draft','published','changed','completed','cancelled')),
  sort_order              int  not null default 0,
  created_by              uuid references auth.users(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
```

**`public.roster_audit_events`**:
```sql
create table public.roster_audit_events (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users(id),
  entity_type  text not null,   -- 'employee_day_card' | 'roster_assignment' | etc.
  entity_id    uuid not null,
  action       text not null,   -- 'create' | 'update' | 'delete' | 'move'
  before_data  jsonb,
  after_data   jsonb,
  created_at   timestamptz not null default now()
);
create index on public.roster_audit_events (entity_type, entity_id, created_at desc);
```

**`public.roster_display_tokens`**:
```sql
create table public.roster_display_tokens (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,                 -- random URL-safe string
  name          text not null,                        -- "Ben's phone", "Workshop TV"
  scope         text not null check (scope in ('personal','shared')),
  employee_id   uuid references public.employees(id) on delete cascade,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  check ((scope = 'personal' and employee_id is not null)
      or (scope = 'shared'   and employee_id is null))
);
```

### Indexes

```sql
create index on public.employee_day_cards (roster_date);
create index on public.employee_day_cards (employee_id, roster_date);
create index on public.roster_assignments (employee_day_card_id);
create index on public.roster_assignments (project_id);
create index on public.project_roster_meta (show_in_side_panel) where show_in_side_panel = true;
```

---

## Auth / RLS

| Table | anon | authenticated | service_role |
|---|---|---|---|
| `employees` (base) | — | — | full (existing) |
| `roster_employees` (view) | — | SELECT | (via base table) |
| `project_roster_meta` | — | full | full |
| `roster_settings` | — | SELECT; UPDATE only via server action | full |
| `employee_day_cards` | — | full | full |
| `roster_assignments` | — | full | full |
| `roster_audit_events` | — | SELECT only (insert/update/delete blocked); writes happen via the service-role admin client inside `logAudit` | full |
| `roster_display_tokens` | — | full | full |
| Display routes | server-validates token, no client SDK access | — | server-side reads via service role |

Display screens never hold a Supabase client. The page server-validates the token, fetches data with the service role, renders read-only HTML, attaches a Realtime subscription scoped to only the relevant roster_date(s).

Authenticated = currently a "team" role per our existing `lib/auth/role.ts`. The `requireRole('team')` guard already exists.

---

## Reads vs writes — overall pattern

- **Initial reads**: server components in `app/team/roster/**/page.tsx` fetch via the user-scoped `createClient()` and pass data as props. No client-side fetch on first render.
- **Mutations**: server actions in `app/team/roster/_actions/*.ts`, wrapped by TanStack Query `useMutation` on the client for optimistic UI + cache invalidation. Server actions own the DB write + audit log write atomically.
- **Live updates**: Supabase Realtime subscription, established in the client `RosterBoard` once mounted, patches the TanStack Query cache when remote changes arrive.
- **Display pages (`/display/*`)**: server components only, no client SDK, no logged-in user. Server-side reads use the admin client (`createAdminClient()`) gated by token validation. Realtime subscription added client-side for live refresh.

Mutation flow per drag/drop action:

1. Client calls server action via TanStack Query `useMutation`
2. `onMutate` writes optimistic update to query cache, returns rollback
3. Server action: Zod validate → Supabase write (user-scoped client) → `logAudit(...)` (admin client) → return new state
4. `onSettled` invalidates affected queries, TanStack refetches
5. Realtime subscription independently updates cache on remote changes

Server actions live in `app/team/roster/_actions/` next to the routes that use them.

Sample shape:
```ts
'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getRosterSettings } from '@/lib/roster/queries'  // implemented in Phase 3
import { logAudit } from '@/lib/roster/audit'             // uses createAdminClient()

const Input = z.object({ employeeId: z.string().uuid(), date: z.string().date() })

export async function createEmployeeDayCard(raw: unknown) {
  const input = Input.parse(raw)
  const supabase = await createClient()              // user-scoped: respects RLS on roster tables
  const settings = await getRosterSettings(supabase)

  const { data, error } = await supabase
    .from('employee_day_cards')
    .insert({
      employee_id: input.employeeId,
      roster_date: input.date,
      start_time: settings.default_start_time,
      finish_time: settings.default_finish_time,
    })
    .select()
    .single()

  if (error) throw error
  await logAudit({                                   // admin-scoped: bypasses audit RLS
    entity_type: 'employee_day_card',
    entity_id: data.id,
    action: 'create',
    after: data,
  })
  return data
}
```

Audit log: written from server actions via the admin client, never via Postgres trigger. Triggers were considered but server-side writes are simpler to debug, easier to attribute to a user, and avoid the "trigger fires from migrations + seeds" problem.

---

## Realtime

Single Supabase Realtime channel per page:

```ts
const channel = supabase
  .channel(`roster:${dateRangeKey}`)
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'employee_day_cards',
      filter: `roster_date=gte.${rangeStart}` },
    handler)
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'roster_assignments' },
    handler)
  .subscribe()
```

Display screens use the same pattern, scoped to their roster_date (today / month).

---

## Display tokens

Settings page (`/team/settings/display`):
- "New display" form: name + scope (Personal / Shared). If Personal, pick employee from dropdown.
- Generates URL-safe token, displays full URL + QR code (use `qrcode` npm pkg).
- Lists existing tokens with last-used timestamp, revoke button.

Display page (`/display/today`):
- Server component reads `?t=<token>`
- Server-side lookup via `createAdminClient()` (no logged-in user, RLS doesn't help us here — token validation is the gate)
- `SELECT * FROM roster_display_tokens WHERE token = $1 AND active = true`; if no match, return 404
- Update `last_used_at` for telemetry
- If `scope='personal'`, fetch only that employee's cards for today + next few days, render phone-friendly single-column layout
- If `scope='shared'`, fetch all cards for today, render group-by-site board (spec's original mode)
- Realtime subscription bootstrapped client-side after initial render, scoped to the relevant `roster_date(s)`

Public URL format: `https://app.overlandbuilders.com.au/display/today?t=<token>` — also rendered as a QR code on the settings page using the `qrcode` npm package.

No client Supabase SDK with secret keys on display pages — only the public anon key (read-only via RLS) is used for the Realtime subscription, and Realtime channels are independently namespaced.

---

## File layout

```
app/
  team/
    layout.tsx                          sidebar + header
    page.tsx                            dashboard (existing, refreshed)
    roster/
      page.tsx                          week view (server shell)
      day/page.tsx
      by-job/page.tsx
      month/page.tsx
      notes/page.tsx
      _components/                      'use client' DnD pieces
        RosterBoard.tsx
        SidePanel.tsx
        EmployeeSourceCard.tsx
        JobSourceCard.tsx
        DayColumn.tsx
        EmployeeDayCard.tsx
        RosterAssignmentBox.tsx
        DetailsSheet.tsx
        DayPlanner.tsx
        ByJobView.tsx
        MonthSummary.tsx
      _actions/
        cards.ts
        assignments.ts
        settings.ts
    jobs/
      page.tsx
      [id]/page.tsx
    employees/
      page.tsx
      [id]/page.tsx
    settings/
      roster/page.tsx
      display/page.tsx
  display/
    today/page.tsx                      public, token-gated
    month/page.tsx
components/
  ui/                                   shadcn-generated
lib/
  roster/
    queries.ts                          server-side data fetch helpers (incl. getRosterSettings)
    mutations.ts                        shared write logic
    types.ts
    warnings.ts                         pure functions for validation
    dates.ts                            date-fns + tz helpers
    tokens.ts                           generate / validate display tokens
    audit.ts                            logAudit helper (admin client)
  query-client.tsx                      TanStack Query provider for client tree
```

---

## Phases

Each phase ends with a passing build, a short summary of what changed, and an explicit checkpoint before the next phase starts.

### Phase 1 — Scaffold + nav
- Install deps
- shadcn init + components (Button, Card, Sheet, Drawer, Dialog, Form, Input, Label, Select, Textarea, Tabs, Tooltip, Sonner)
- `app/team/layout.tsx` sidebar + header
- Stub pages for all new routes (just titles)
- TanStack Query provider added at the root client boundary
- Smoke test: throwaway `/_smoke` route renders shadcn `Button`, `Card`, `Dialog`, `Sheet`, and a basic Form; confirm CSS variables resolve, fonts look right, Dialog open/close works, no console errors. Delete the route before merging.

### Phase 2 — DB
- Single migration file in `supabase/migrations/`
- All new tables + new columns on `employees` + `roster_employees` view + RLS
- Seed `roster_settings` row (already in the migration via INSERT)
- **No data seed for trades / is_roster_employee** — Cam sets these via the admin UI in Phase 3. No migration writes data we'd then have to re-seed via UI.

### Phase 3 — Admin CRUD
- `/team/employees` — list real employees, edit trade + is_roster_employee + sort_order
- `/team/jobs` — list real projects, toggle show_in_side_panel, set colour, optional default times, set roster display_name (see open call below)
- `/team/settings/roster` — defaults form
- During this phase, audit which of the 17 active employees have a contact email — anyone without one can't get a magic link or own a personal display token. Flag to Cam, don't fix in code.

### Phase 4 — Roster board v1 (Week view)
- Server component shell fetches initial week data
- `RosterBoard.tsx` client component with dnd-kit
- Side panel: rosterable employees + visible jobs
- Day columns, employee-day cards, roster-assignment boxes
- All four drag/drop combinations
- Server actions for create/move/delete on cards and assignments
- TanStack Query optimistic + reconcile
- Audit log writes inside every action

### Phase 5 — Notes drawer + Notes view
- `DetailsSheet.tsx` for card editing
- Same sheet (or sibling) for assignment editing
- Note icon on condensed cards
- `/team/roster/notes` filtered list

### Phase 6 — Other manager views
- `/team/roster/day`
- `/team/roster/by-job`
- `/team/roster/month`

### Phase 7 — Display screens + Realtime
- `/team/settings/display` — token CRUD + QR code generation
- `/display/today` — personal + shared modes
- `/display/month`
- Supabase Realtime subscriptions on all real-time views
- Final polish, responsive sweep, build + lint pass

---

## Acceptance criteria for alpha

(Adapted from spec; "manager" = anyone with team role.)

- Logged-in team member can edit roster
- Can add/edit employees (trade + roster visibility)
- Can add/edit projects' roster meta + show_in_side_panel toggle
- Can set roster defaults
- Can drag a roster-active employee into Monday → creates 7:30–4:30 card
- Can drag a visible project onto that card → creates assignment
- Can add/edit per-assignment notes
- Condensed cards show note icon only, not full notes
- One employee can have two assignments on one day with separate times + notes
- By Job view shows who's on each project
- Notes view shows only assignments with notes
- Personal display token shows that employee's day only, on phone screen
- Shared display token shows group-by-site board
- Display updates after a roster change (Realtime)
- Build + lint pass

---

## Smaller open calls (decide as we go, not blocking)

- **Project display name in roster UI** — `public.projects` has no clean `name` column (Airtable primary is a formula). Options: `job_code + suburb` (e.g., "015PRO · Strathmore"), `job_code + truncated street_address`, or add a `display_name text` to `project_roster_meta` for manual control. Lean toward adding `display_name` — falls back to `job_code + suburb` if null. Decide before Phase 4 side-panel build.
- **Job colour palette UI** — curated 8-colour Overland-aligned set + free-form hex picker? Or pure free-form? Lean toward curated + fallback.
- **Trade vocabulary** — free text in alpha. Migrate to a `trades` reference table if/when Cam wants controlled values.
- **Card sort within day** — alpha just uses `sort_order int` with manual drag-reorder later; initial sort by employee `roster_sort_order`.
- **Status field on cards/assignments** — exists in schema for the eventual draft/publish workflow. Alpha treats everything as `'draft'`; publish button is a placeholder per spec.
- **`projects.roster_only` (existing flag)** — Cam to decide if/how it interacts with `project_roster_meta.show_in_side_panel`. Probably orthogonal but worth a 30-sec sync at Phase 3.
- **Manager-vs-staff sub-role** — alpha gives every `team` role member full edit access. Add a `team_role enum ('manager','staff')` (or similar) when field staff get accounts and we need to restrict edits.

---

## Risks / things to watch

- **shadcn + Tailwind 4 + React 19 + Next 16** — newest of newest. Smoke test in Phase 1.
- **dnd-kit on touch** — works but needs `PointerSensor` with `activationConstraint` for tablet drag start. Not blocking laptop-primary.
- **Supabase Realtime quota** — free plan limits. Display screens leave a persistent subscription open — watch concurrent connection count.
- **Audit log growth** — every drag writes a row. At Overland scale this is fine; revisit if it grows past ~1M rows in a year.
- **TanStack Query devtools** — useful but ship-only-in-dev (next/dynamic + conditional import).

---

## Source materials

- Spec: `C:\Users\cam\Downloads\claude_roster_alpha_prompt.md`
- Existing Supabase migration plan: `C:\Users\cam\HQ Overland\08_systems\supabase\migration-plan.md`
- Existing employees migration: `C:\Users\cam\HQ Overland\08_systems\supabase\migrations\20260515114000_create_employees.sql`
- App scaffold handoff: `C:\dev\overland-app\HANDOFF.md`
