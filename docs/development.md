# Development

## Roadmap

| Phase | Scope                                                | Status      |
| ----- | ---------------------------------------------------- | ----------- |
| 1     | Monorepo, Next.js, NestJS, Docker, Prisma, health    | ✅ Done     |
| 2     | Prisma schema, migrations, seed, database services   | ✅ Done     |
| 3     | Auth, Projects / Videos / Creators / Hashtags / Metrics CRUD | ✅ Done |
| 4     | BullMQ, ScrapingJob, Apify, TikTok adapter           | ✅ Done     |
| 5     | Analytics engine, rankings, trends                   | ✅ Done     |
| 6     | OpenAI service, video classifier, AI insights        | ✅ Done     |
| 7     | Content ideas, scripts, captions, content planner    | ✅ Done     |
| 8     | Dashboard UI                                         | ✅ Done     |
| 9     | Embeddings, pgvector, semantic search, opportunity score | ✅ Done |
| 10    | Testing, security, docs                              | ✅ Done |

## Getting started

```bash
npm install                # installs workspaces + prisma generate (postinstall)
docker compose up -d       # PostgreSQL + Redis
copy .env.example .env     # then fill in JWT_SECRET (and optional keys)
npm run db:migrate
npm run db:seed
npm run dev                # web + api
```

## Workspace scripts

```bash
npm run dev                # web + api concurrently
npm run dev:web            # Next.js on :3000
npm run dev:api            # NestJS on :3001 (builds @traveltok/database first)
npm run dev:worker         # BullMQ workers (Phase 4)
npm run build              # packages → api → web
npm run lint               # ESLint, all workspaces
npm run typecheck          # tsc --noEmit, all workspaces
npm test                   # jest, all workspaces
npm run test:e2e           # api e2e (builds shared packages first)
```

## Working with shared packages

- `@traveltok/types` is type-only; edit `packages/types/src/index.ts` directly.
- `@traveltok/database` is compiled (`tsc` → `dist`). After changing it, run
  `npm run build -w @traveltok/database` (done automatically by `dev:api`,
  `build`, and `test:e2e`).
- Changing `prisma/schema.prisma` requires `npm run db:generate` then
  `npm run db:migrate`.

## Prisma v7 notes

- Environment is loaded explicitly (`dotenv/config` in `prisma.config.ts`).
- `migrate dev` does not auto-generate — always run `db:generate` after schema
  changes.
- Driver adapters are mandatory; we use `@prisma/adapter-pg` (dual ESM/CJS).
- Seeding is explicit: `npm run db:seed` → `tsx prisma/seed.ts`.

## Conventions

- One NestJS module per domain (controller + service + dto + module).
- TypeScript strict mode; typed DTOs; validation on every external input.
- No secrets in code or Git; backend-only access to OpenAI and Apify.
