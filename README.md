# TravelTok AI — Analytics & AI Content Planner

> Analytics platform for travel / tourism TikTok content: ingests TikTok data,
> surfaces trends and high-performing patterns, and uses AI to generate content
> strategies, ideas, scripts, captions, and full content plans.

## Overview

TravelTok AI follows this pipeline:

```
TikTok Data → Data Collection → Data Cleaning → PostgreSQL → Analytics Engine
→ AI Content Analysis → Trend Detection → Content Opportunity Detection
→ AI Content Ideas → AI Content Plan → Dashboard
```

The initial domain focus is **Indonesian travel content** (keywords such as
`wisata indonesia`, `liburan indonesia`, `hidden gem indonesia`, `travel murah`).

The stack:

| Layer      | Technology                                                        |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Recharts + TanStack Query + React Hook Form + Zod |
| Backend    | NestJS 11 + TypeScript + REST API + Prisma ORM                    |
| Database   | PostgreSQL 16 (+ pgvector for semantic search)                    |
| Queue      | Redis + BullMQ                                                    |
| Ingestion  | Apify (configurable TikTok actor)                                 |
| AI         | Gemini (structured JSON output + embeddings)                      |
| Dev        | Docker Compose, npm workspaces, Jest, ESLint                      |

> **Status: PHASE 10 (hardened, production-ready).** JWT auth + full CRUD API,
> the BullMQ scraping worker, the analytics/trend-scoring engine (incl. ranked
> content opportunities), the AI engine (video classification, project
> insights, AI content ideas, scripts, captions, and a content planner),
> pgvector semantic search over videos/ideas/trends, and the Next.js dashboard
> (overview, analytics, ideas, plans, trends, search) are all live. Transport
> hardening is in place (Helmet headers, CORS allow-list, rate limiting,
> bcrypt, ownership checks, Zod validation). Mock AI by default; Gemini when
> `GEMINI_API_KEY` is set. Register, create a project, hit **Scrape real data**
> to pull real TikTok videos via Apify, then generate AI content. See
> [docs/development.md](docs/development.md) for the roadmap and
> [docs/security.md](docs/security.md) for the security model.

## Requirements

- Node.js >= 20.19 (Node 22+ recommended)
- npm >= 10
- Docker + Docker Compose (for PostgreSQL and Redis)
- Git

## Repository structure

```
traveltok-ai/
├── apps/
│   ├── web/          Next.js frontend
│   └── api/          NestJS backend API
├── packages/
│   ├── database/     Prisma client + shared database services
│   ├── types/        Shared types (type-only package)
│   └── ai/           Shared AI utilities (classifier, generators, planner)
├── prisma/           Prisma schema + migrations (root)
├── docker/           Docker notes
├── docs/             Documentation
├── scripts/          Utility scripts
├── .env.example      Environment variable template
└── docker-compose.yml
```

## Quick start

```bash
# 1. Install dependencies (workspaces + generates the Prisma client)
npm install

# 2. Start PostgreSQL + Redis
docker compose up -d

# 3. Configure environment
#    Windows:  copy .env.example .env
#    Unix:     cp .env.example .env
#    (generate a JWT_SECRET and add optional OPENAI_API_KEY / APIFY_API_TOKEN)

# 4. Run database migrations
npm run db:migrate

# 5. Seed development data (realistic synthetic data, labeled isSeedData)
npm run db:seed

# 6. Run everything (web + api)
npm run dev
```

Point your browser to:

- Frontend: http://localhost:3000
- Backend health: http://localhost:3001/health

Or run the apps separately:

```bash
npm run dev:web      # Next.js on :3000
npm run dev:api      # NestJS API on :3001 (builds shared packages first)
```

## Environment variables

Copy `.env.example` to `.env` at the repo root. Key variables:

| Variable                | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string (Prisma + backend) |
| `REDIS_URL`             | Redis connection string (queues/cache)   |
| `JWT_SECRET`            | Auth signing secret (do not reuse dev value in prod) |
| `OPENAI_API_KEY`        | OpenAI key (backend only)                |
| `APIFY_API_TOKEN`       | Apify token (backend only)               |
| `APIFY_TIKTOK_ACTOR_ID` | Apify TikTok actor ID (configurable)     |
| `NEXT_PUBLIC_API_URL`   | Public API base URL (frontend)           |

The frontend reads `NEXT_PUBLIC_API_URL` from `apps/web/.env.local`
(see `apps/web/.env.example`).

**Never commit real secrets.** Only `.env.example` files are tracked.

## Docker

`docker-compose.yml` provides PostgreSQL 16 with pgvector and Redis 7 with
persistent volumes and healthchecks. No production secrets are stored in the
compose file — credentials come from `.env` via `${VAR:-default}` substitution.

```bash
docker compose up -d
docker compose ps        # wait for "healthy"
docker compose down      # keep volumes
docker compose down -v   # wipe volumes
```

## Database (Prisma)

Prisma ORM v7 with the `prisma-client` generator (driver adapter `@prisma/adapter-pg`).
Schema lives in `prisma/schema.prisma`; migrations in `prisma/migrations`.

```bash
npm run db:generate        # regenerate the client (into packages/database)
npm run db:migrate         # apply + create migrations (dev)
npm run db:migrate:deploy  # apply migrations (non-interactive/prod)
npm run db:studio          # Prisma Studio
```

## Backend (apps/api)

```bash
npm run dev:api            # watch mode (builds shared packages first)
npm run build -w @traveltok/api
npm run start:prod -w @traveltok/api
```

Health endpoint: `GET /health` reports API, PostgreSQL, and Redis status
(e.g. `{"status":"ok","checks":{"database":{...},"redis":{...}}}`).

## Frontend (apps/web)

```bash
npm run dev:web
```

## Testing

```bash
npm test                 # unit tests across workspaces
npm run test:e2e -w @traveltok/api
npm run typecheck        # TypeScript checks across workspaces
npm run lint             # ESLint across workspaces
```

## Apify configuration

TikTok data ingestion runs asynchronously through the backend (never from the
browser). Set `APIFY_API_TOKEN` and `APIFY_TIKTOK_ACTOR_ID` in `.env`. The
scraper is behind a configurable adapter (`ApifyService` → `TikTokScraperService`
→ `TikTokDataMapper`), so the actor can be swapped without touching callers.
Until credentials are configured, a development mock adapter can be used.

## OpenAI configuration

Set `OPENAI_API_KEY` in `.env` (backend only). All AI calls use structured JSON
output with validated responses and versioned prompts. Bulk analysis runs
asynchronously via BullMQ.

## Development commands

| Command             | Action                                   |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Run web + api concurrently               |
| `npm run dev:web`   | Next.js dev server                       |
| `npm run dev:api`   | NestJS API (watch)                       |
| `npm run dev:worker`| BullMQ scraping worker (mock or Apify)    |
| `npm run db:generate` | Regenerate Prisma client               |
| `npm run db:migrate`  | Apply dev migrations                   |
| `npm run db:seed`     | Seed development data                  |
| `npm run test`      | Unit tests                               |
| `npm run typecheck` | TypeScript checks                        |
| `npm run lint`      | ESLint                                   |

## Documentation

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [API](docs/api.md)
- [AI](docs/ai.md)
- [Scraping](docs/scraping.md)
- [Analytics](docs/analytics.md)
- [Development](docs/development.md)

## License

MIT — see [LICENSE](LICENSE).
