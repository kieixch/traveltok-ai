# Architecture

> Phase 1 — infrastructure. Higher-level sections are filled in as features
> land (Phases 2–10). This file always describes the *current* state.

## Monorepo

npm workspaces monorepo:

```
traveltok-ai/
├── apps/
│   ├── web/                  Next.js 16 frontend (port 3000)
│   └── api/                  NestJS 11 backend (port 3001)
├── packages/
│   ├── database/             Prisma client + PrismaService (compiled → dist)
│   ├── types/                Shared types (type-only)
│   └── ai/                   Shared AI utilities (Phase 6)
├── prisma/                   Canonical Prisma schema + migrations
├── docker/                   Docker notes
├── docs/                     Documentation
├── scripts/                  Utility scripts
├── docker-compose.yml        PostgreSQL + Redis for local dev
└── prisma.config.ts          Prisma CLI configuration (v7)
```

Shared packages:

- `@traveltok/types` — type-only package resolved directly from `src/index.ts`.
- `@traveltok/database` — compiled to `dist`; consumed by the API and future
  workers. Regenerate the Prisma client with `npm run db:generate` before
  building (`prisma generate` runs automatically on `postinstall` too).

## Request flow

```
Browser (apps/web)
   │  HTTPS / REST + JSON
   ▼
NestJS API (apps/api)  ──►  PostgreSQL (Prisma / @traveltok/database)
   │                        Redis (BullMQ queues — scraping worker)
   ├── modules: health, auth, projects, creators, videos, hashtags,
   │            scraping-jobs, trends, content-ideas, content-plans
   └── async workers: scraping (BullMQ, separate process via npm run dev:worker)
```

### Data pipeline (target)

```
TikTok → Apify (backend only) → TikTokDataMapper → PostgreSQL
       → Analytics Engine → Trend Detection → AI Analysis → Ideas → Plan → Dashboard
```

## Technology decisions

| Decision                     | Rationale                                                  |
| ---------------------------- | ---------------------------------------------------------- |
| Prisma ORM v7 `prisma-client`| Rust-free client, driver adapter `@prisma/adapter-pg`, generated into the repo |
| `moduleFormat = "cjs"`       | NestJS API runs on CommonJS                                |
| pgvector/pgvector:pg16 image | PostgreSQL + pgvector for semantic search (Phase 9)        |
| Health endpoint is degraded-tolerant | API boots even if infra is down; /health reports each service |
| Env via root `.env` + `@nestjs/config` | Single source of truth for backend/Prisma/Docker   |

## Cross-cutting concerns

- **Validation**: global `ValidationPipe` (whitelist + transform) in `main.ts`.
- **CORS**: enabled for development; tightened in the security phase.
- **Logging**: NestJS Logger + structured errors (Phase 10 hardening).
- **Secrets**: only in `.env` (gitignored); never in the frontend bundle.
