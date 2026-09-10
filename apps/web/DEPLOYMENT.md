# TravelTok AI — Vercel Deploy Guide (Free Tier)

The full application (web + API) now runs as one Next.js app under `apps/web`.
There is no separate NestJS backend or queue worker: scraping is either synchronous
(`SCRAPING_MODE=mock`) or driven by an Apify webhook back to this same app.

`vercel.json` at the repository root handles the monorepo:
`rootDirectory: "apps/web"`, and `buildCommand: "npm run build"` builds the
`@traveltok/database` + `@traveltok/ai` workspace packages before `next build`.

## 1. One-click import

1. Push this repository to GitHub.
2. In Vercel: **Add New Project → Import** the repo. Vercel reads `vercel.json`
   automatically (framework = Next.js, root = `apps/web`).
3. No build command / output directory changes needed.

> A plan with a credit card is **not** required. The free (Hobby) tier is enough;
> it also supports the Apify webhook to `/api/scraping-jobs/[id]/complete`.

## 2. Database (Neon Postgres, free tier)

1. Create a serverless Postgres at https://neon.tech (free tier).
2. Copy the connection string from the dashboard (the `?sslmode=require` /
   `?sslmode=require` variant for Prisma).
3. Apply the schema:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

## 3. Environment variables

Set these in **Vercel Project → Settings → Environment Variables** (Production).

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon (or any Postgres) connection string. |
| `JWT_SECRET` | yes | ≥ 32 chars. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | no | default `7d`. |
| `AI_MODE` | no | `mock` (default, works with no keys) or `gemini`/`openai`. |
| `GEMINI_API_KEY` | if `AI_MODE=gemini` | API key; see `GEMINI_MODELS` for free models. |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `OPENAI_EMBEDDING_MODEL` | if `AI_MODE=openai` | |
| `GEMINI_MODELS`, `GEMINI_EMBEDDING_MODEL` | no | Comma-separated pickable models. |
| `APIFY_API_TOKEN` | if real scraping | Apify API token. |
| `APIFY_TIKTOK_ACTOR_ID` | if real scraping | TikTok actor ID, e.g. `clockworks/tiktok-scraper`. |
| `SCRAPING_MODE` | no | `mock` (default) or `apify`. |
| `NEXT_PUBLIC_SITE_URL` | if `apify` | Your Vercel URL, e.g. `https://traveltok-ai.vercel.app`. Webhook base URL. |
| `WEBHOOK_BASE_URL` | no | Overrides webhook base URL (defaults to `NEXT_PUBLIC_SITE_URL`). |
| `SCRAPE_WEBHOOK_SECRET` | if `apify` | Secret appended to the webhook URL for auth. |
| `TREND_WEIGHT_*` | no | Analytics trend weights (defaults in `.env.example`). |

**Do NOT** set `NEXT_PUBLIC_API_URL` — the client defaults to same-origin `/api`.

### Scraping modes

- `mock` → scraping runs synchronously inside the request; no Apify needed.
- `apify` → POST `/api/projects/[id]/scrape` creates a ScrapingJob, starts an Apify
  run, and registers a webhook to
  `/api/scraping-jobs/[id]/complete?token=<SCRAPE_WEBHOOK_SECRET>`.
  When the run finishes, Apify calls that public route, results are persisted, and
  the job becomes `COMPLETED`. Poll GET `/api/scraping-jobs/[id]` for status.

## 4. Verify

- `GET /api/health` returns `{"success":true,...}` with database status.
- Register → create project → scrape (mock) → videos/analytics populate.
- `GET /api/ai/providers` shows `current: "mock"` (or your configured provider).

## 5. Local development

```bash
npm install
npm run dev            # builds packages, then next dev on http://localhost:3000
```

Postgres: `docker compose up -d postgres`, then copy `apps/web/.env.example` ideas
into `apps/web/.env.local` (see that file's existing values for local smoke tests).
For local runs keep `SCRAPING_MODE=mock` — Apify cannot reach `localhost`.