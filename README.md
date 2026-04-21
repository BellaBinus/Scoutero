# Scoutero

A personal job scouting app that monitors target companies' careers pages for relevant openings and surfaces them in one place.

![Scoutero](attached_assets/scoutero-preview.jpg)

## What it does

- **Track companies** — maintain a list of companies whose careers pages you want to watch
- **Keyword filtering** — define include and exclude keywords; the scraper uses them to surface only relevant listings
- **Search history** — every scan is stored so you can revisit past results
- **Job status tracking** — mark listings as saved, applied, rejected, or ignored
- **Admin ops log** — health scans and scrape runs are logged for visibility

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Express 5, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk |
| API contract | OpenAPI spec → Orval codegen (React Query hooks + Zod schemas) |
| Monorepo | pnpm workspaces |

## Project structure

```
├── artifacts/
│   ├── api-server/     # Express API
│   └── job-scout/      # React + Vite frontend
├── lib/
│   ├── api-spec/       # OpenAPI spec + Orval config
│   ├── api-client-react/  # Generated React Query hooks
│   ├── api-zod/        # Generated Zod schemas
│   └── db/             # Drizzle schema + DB connection
└── scripts/
```

## Getting started

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL database
- [Clerk](https://clerk.com) account

### 1. Clone and install

```bash
git clone https://github.com/your-username/scoutero.git
cd scoutero
pnpm install
```

### 2. Set environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys |
| `VITE_CLERK_PROXY_URL` | Only needed if proxying Clerk through your domain |

### 3. Push the database schema

```bash
pnpm --filter @workspace/db run push
```

### 4. Run the app

Start both servers in separate terminals:

```bash
# API server (default port 3001)
pnpm --filter @workspace/api-server run dev

# Frontend (default port 5173)
pnpm --filter @workspace/job-scout run dev
```

Open `http://localhost:5173`.

## Development

### Regenerate the API client

After changing the OpenAPI spec in `lib/api-spec/`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

### Typecheck the whole monorepo

```bash
pnpm run typecheck
```

## Admin access

The first user to sign in can be granted admin rights directly in the database:

```sql
UPDATE users SET is_admin = true WHERE id = '<clerk-user-id>';
```

Admins can manage the company list, view the ops log, and trigger health scans.

## License

MIT
