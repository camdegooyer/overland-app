# overland-app — handoff

Initial scaffold of the Next.js 16 + Supabase app for `app.overlandbuilders.com.au`.

## What's built

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase SSR auth (magic link).

**Routes**

| Path | Auth | Purpose |
|---|---|---|
| `/` | public | Two-button landing: Team / Clients |
| `/login?role=team\|client` | public | Magic-link email form (server action) |
| `/login/sent` | public | "Check your inbox" confirmation |
| `/auth/callback` | public | Exchanges Supabase code for session |
| `/auth/sign-out` (POST) | any | Signs out, redirects to `/` |
| `/dashboard` | signed-in | Router: looks up role, redirects to `/team` or `/portal` |
| `/team` | role=team | Stub team workspace (cards) |
| `/portal` | role=client | Stub client portal (cards) |

**Auth model**

Single magic-link backend; role is determined server-side by mapping
`auth.user.email` → `public.contacts.email` → presence in `employees` or
`project_owners`. Team beats client if both match.

Role resolution lives in `lib/auth/role.ts`. Page-level guards in
`lib/auth/guard.ts`. Cookie refresh in `proxy.ts` (Next 16 renamed
`middleware.ts` → `proxy.ts`).

**Why service role for role lookup?** `contacts`, `employees` and
`project_owners` were migrated with RLS strict (service-role only — see
`08_systems/supabase/migration-plan.md`). To resolve a user's role we
need to read those tables server-side. Using the service-role key here
is the minimum-friction path. The longer-term cleanup is to add narrow
RLS policies that let an authenticated user read only their own contact
row, then drop `lib/supabase/admin.ts`.

## What Cam needs to do before this works end-to-end

### 1. Fill in `.env.local` (local dev)

From the Supabase dashboard → Project Settings → API:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service role secret>
```

`.env.local` is already gitignored by the Next scaffold.

### 2. Add the same vars to Vercel

Vercel dashboard → `overland-app` project → Settings → Environment
Variables. Add all three for **Production**, **Preview** and
**Development** scopes. Redeploy.

The service-role key must NOT have the `NEXT_PUBLIC_` prefix — keeps it
server-only.

### 3. Configure Supabase Auth (one-time)

Supabase dashboard → Authentication → Sign In / Providers:

- **Email** provider: enabled (it is by default). Magic link is on by
  default.

Supabase dashboard → Authentication → URL Configuration:

- **Site URL**: `https://app.overlandbuilders.com.au`
- **Redirect URLs** (add all):
  - `https://app.overlandbuilders.com.au/auth/callback`
  - `https://*.vercel.app/auth/callback` (for preview deploys)
  - `http://localhost:3000/auth/callback` (for local dev)

Without these, the magic-link redirect will be rejected.

### 4. Decide which contacts get access

The role resolver assumes:

- A logged-in **employee** has a row in `public.contacts` with their
  email AND a corresponding row in `public.employees`.
- A logged-in **client** has a row in `public.contacts` with their email
  AND is referenced by `public.project_owners.contact_id`.

If you want to test as yourself, make sure `cam@overlandbuilders.com.au`
(or whichever email you'll sign in with) exists in `public.contacts` and
is linked to either `employees` or `project_owners`.

### 5. Vercel framework detection

The Vercel project was originally configured as a static site. Push the
new Next.js code to `main` and Vercel should auto-detect the framework
on first build. If it doesn't, check the project's Build & Development
Settings → Framework Preset is set to "Next.js".

## Running locally

```powershell
cd C:\dev\overland-app
npm run dev
```

Then open http://localhost:3000.

## Files of interest

```
app/
  page.tsx                    landing
  login/
    page.tsx                  magic-link form
    actions.ts                "use server" — sends OTP
    sent/page.tsx             confirmation
  auth/
    callback/route.ts         code → session
    sign-out/route.ts         POST sign-out
  dashboard/page.tsx          role router
  team/page.tsx               stub
  portal/page.tsx             stub
  _components/
    SignedInHeader.tsx        shared header
lib/
  supabase/
    client.ts                 browser
    server.ts                 server (cookies)
    proxy.ts                  proxy-helper (cookie refresh)
    admin.ts                  service-role client
  auth/
    role.ts                   resolveRole(email)
    guard.ts                  requireRole(expected)
proxy.ts                      root proxy
```

## Known gaps / next steps

- **No data yet** — `/team` and `/portal` are static stubs. Each card is
  a placeholder for a real page.
- **RLS cleanup** — replace the service-role role lookup with proper RLS
  policies (one migration: `auth.jwt() ->> 'email' = contacts.email`
  for SELECT). Then `lib/supabase/admin.ts` can go.
- **Email styling** — the magic-link email uses Supabase's default
  template. Customise in Supabase dashboard → Authentication → Email
  Templates → Magic Link if you want Overland branding.
- **Repo hygiene** — `_archive/placeholder-index.html` is the old static
  landing; safe to delete once the new site is live.
