# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Authentication**: Clerk (via `@clerk/react` on frontend, `@clerk/express` on backend)

## Artifacts

### Job Scout (`artifacts/job-scout`)
React + Vite web app for scouting job listings across target companies.
- Preview path: `/`
- Features: manage target companies, run keyword-based job searches, view search history

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── job-scout/          # React + Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks (+ custom-hooks.ts overrides)
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Authentication (Clerk)

Authentication uses Clerk (migrated from Replit Auth in April 2026).

**Backend (`artifacts/api-server`):**
- `@clerk/express` + `clerkMiddleware()` validates all requests
- `artifacts/api-server/src/middlewares/clerkAuth.ts` exports `requireAuth` and `requireAdmin` middleware
- `requireAuth` extracts `userId` from `sessionClaims.userId` (migrated users) or `auth.userId`, sets `req.userId`
- `requireAdmin` queries `users` table to check `isAdmin` flag
- `/api/me` endpoint returns `{ isAdmin: boolean }` for the current user
- Old auth routes (`/api/login`, `/api/callback`, `/api/logout`, `/api/auth/user`) removed
- Packages removed: `openid-client`, `cookie-parser`

**Frontend (`artifacts/job-scout`):**
- `@clerk/react` provides `<ClerkProvider>`, `useUser()`, `useClerk()`, `Show`
- `ClerkProvider` wraps the entire app with Scoutero branding (moss green theme)
- `/sign-in` and `/sign-up` routes use `<SignIn>` and `<SignUp>` with `routing="path"`
- `artifacts/job-scout/public/logo.svg` — branded binoculars SVG for Clerk sign-in page
- `useIsAdmin()` hook fetches `/api/me` via `useGetMe()` from the generated client
- Package removed: `@workspace/replit-auth-web`

**Admin identity:**
- First user who logged in via Replit Auth has `isAdmin: true` in `users` table
- After migration, `sessionClaims.userId` returns the original Replit Auth ID, matching the DB record
- Admin can: add/edit/delete companies, access Ops Log, run health scans

## Database Schema

- `users` — user info with `isAdmin` flag and optional `minKeywordFrequency` setting
- `sessions` — kept (not actively used by Clerk but not dropped)
- `companies` — target companies (global, admin-managed)
- `keywords` — per-user include/exclude keyword list (`userId` required)
- `searches` — per-user search history (`userId` required)
- `job_listings` — per-user job results (`userId` required)
- `settings` — global default settings (single row, id=1)
- `scan_log` — health scan and search run log for admin ops view

## API Routes (all under /api, all require auth unless noted)

- `GET /api/me` — current user's `{ isAdmin }` (requires auth)
- `GET /api/healthz` — health check (public)
- `GET /companies` — list companies (all users)
- `POST /companies` — add company (admin only)
- `PATCH /companies/:id` — update company (admin only)
- `DELETE /companies/:id` — remove company (admin only)
- `GET /keywords` — list user's keywords
- `POST /keywords` — add keyword
- `DELETE /keywords/:id` — remove keyword
- `GET /jobs` — user's job listings
- `GET /searches` — user's search history
- `POST /searches` — run a new search (scrapes careers pages, scoped to user)
- `GET /searches/:id` — get search + results (user-scoped)
- `GET /searches/:id/jobs` — get jobs for a search (user-scoped)
- `PATCH /jobs/:id/status` — update job status
- `PATCH /jobs/batch-status` — batch update job statuses
- `GET /settings` — global settings
- `PATCH /settings` — update global settings (admin only)
- `GET /user/settings` — user's own settings
- `PATCH /user/settings` — update user's own settings
- `GET /admin/ops-log` — health scan log (admin only)
- `POST /admin/health-scan` — trigger health scan (admin only)
- `GET /resumes` — user's resumes
- `POST /resumes` — create resume
- `PATCH /resumes/:id` — update resume
- `DELETE /resumes/:id` — delete resume

## Design & Palette

Scoutero palette graduated from mockup (April 2026):
- **Canvas** `#fffef4` — main content background, dropdown inputs
- **Sandstone** `#e4cd99` — sidebar background, card/dropdown borders, controls border
- **Orchid** `#f39cc7` / `#b55a8a` — accent (keywords link, admin badge)
- **Moss** `#4d7435` — primary buttons, headings, nav active state, labels

CSS variable assignments (`:root`):
- `--primary`: moss green `97 37% 33%` (was blue)
- `--border`, `--card-border`, `--popover-border`: sandstone `42 58% 75%` (was moss green)
- `--ring`: moss green `97 37% 33%`
- `--muted` / `--muted-foreground`: warm sandy tones

Layout structure (app-layout.tsx):
- Full-width top ribbon (60px, sandstone): logo left (220px) | nav tabs centered | user info + logout right
- Sidebar (220px, sandstone variant): "Activity Overview" label + 3 stat cards (New Jobs, Target Location, Last Scan) + copyright footer
- Main content: flex-1, canvas background, scrollable

## Job Scraping

The scraper (`artifacts/api-server/src/lib/job-scraper.ts`) fetches company careers pages, extracts job-related links and tries JSON job feeds (`/api/jobs`, `/jobs.json`, etc.), and filters results by the given keywords.

### Ashby Location Normalisation (Fixed April 2026)

Ashby uses `location` + `secondaryLocations[]` to indicate **eligible countries**, not the HQ city. For remote jobs (`workplaceType="Remote"`), each country segment is preserved as `"Remote (Country)"` so the US location filter can correctly exclude non-US postings.

- Segments already starting with "Remote" (e.g. `"Remote (Canada)"`) → kept as-is
- Non-"Remote" segments on a remote job (e.g. `"United Kingdom"`) → `"Remote (United Kingdom)"`
- If **any** segment matches `US_REMOTE_RE` → entire location collapsed to plain `"Remote"`
- No location data at all + remote job → `"Remote"`

The `isBroadlyUs()` filter (both frontend and backend) correctly rejects `"Remote (United Kingdom)"`, `"Remote (Canada)"` etc. via `NON_US_INDICATORS` (contains "uk", "canada", etc.). Combined multi-country strings like `"Remote (United Kingdom); Remote (Canada); ..."` are also rejected because NON_US_INDICATORS matches on the full string even before segment-splitting.

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- Run codegen: `pnpm --filter @workspace/api-spec run codegen`
- Push DB schema: `pnpm --filter @workspace/db run push`
