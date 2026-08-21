# API

> Status: **Phase 10** — JWT auth + CRUD for core entities, the BullMQ scraping
> pipeline, the analytics engine (incl. opportunity scores), the AI suite, the
> demo-data bootstrap, pgvector semantic search, and transport hardening
> (Helmet, restricted CORS, rate limiting) are implemented. The API is the
> single backend consumed by the web dashboard.

## Conventions

- Base URL: `http://localhost:3001` (configurable via `PORT`).
- Global prefix: `API_PREFIX` env (default empty → routes at `/auth`, `/projects`, ...).
- Content type: `application/json`.

### Authentication

`POST /auth/register` and `POST /auth/login` are public. Every other endpoint
requires a Bearer token:

```
Authorization: Bearer <token>
```

- Passwords are hashed with bcrypt (10 rounds).
- `JWT_SECRET` is required (API refuses to boot without it).
- `JWT_EXPIRES_IN` (default `7d`) supports `s`/`m`/`h`/`d`/`w` suffixes.

### Transport security

- **Helmet** headers are applied to every response (`nosniff`,
  `X-Frame-Options`, CSP, ...).
- **CORS** reflects `CORS_ORIGINS` (comma-separated; missing or `*` reflects
  any origin). `credentials: true` is always set.
- **Rate limiting** (per IP): global `RATE_LIMIT_GLOBAL_LIMIT` (default 300)
  per `RATE_LIMIT_TTL_SECONDS` (default 60); `/auth/*` is capped at 10/min.
  `RATE_LIMIT_DISABLED=true` turns it off (tests only).

See [docs/security.md](security.md) for the full model.

### Success envelope

All 2xx responses are wrapped by a global interceptor:

```json
{
  "success": true,
  "data": { }
}
```

- `BigInt` metric fields (views, likes, ...) are serialized as numbers.
- `Date` fields are serialized as ISO 8601 strings.
- `GET /health` is the only endpoint that keeps its own raw shape.

### Error envelope

All errors are normalized by a global filter:

```json
{
  "success": false,
  "message": "Email is already registered",
  "code": "CONFLICT",
  "details": []
}
```

Common codes:

| Code                        | HTTP | Meaning                                   |
| --------------------------- | ---- | ----------------------------------------- |
| `VALIDATION_ERROR`          | 400  | DTO validation failed (`details` per field) |
| `UNAUTHORIZED`              | 401  | Missing/invalid token or credentials      |
| `FORBIDDEN`                 | 403  | Insufficient role                         |
| `NOT_FOUND`                 | 404  | Resource missing (incl. `P2025`)          |
| `CONFLICT`                  | 409  | Duplicate email / business conflict       |
| `UNIQUE_CONSTRAINT_VIOLATION` | 409 | DB unique constraint (`P2002`)          |
| `INTERNAL_ERROR`            | 500  | Unexpected error                          |

### Pagination

List endpoints accept `page`, `pageSize` (1–100, default 20) and `order`
(`asc` | `desc`). Responses use the `Paginated<T>` shape:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 120,
  "totalPages": 6
}
```

## Endpoints

### Health (public)

| Method | Path      | Description                                  |
| ------ | --------- | -------------------------------------------- |
| GET    | `/health` | API + PostgreSQL + Redis status (always 200) |

### Auth (public for register/login)

| Method | Path           | Body                                   | Description                  |
| ------ | -------------- | -------------------------------------- | ---------------------------- |
| POST   | `/auth/register` | `{ name, email, password }`          | Register → `{ token, user }` |
| POST   | `/auth/login`    | `{ email, password }`                 | Login → `{ token, user }`    |
| GET    | `/auth/me`       | —                                      | Current user (Bearer)        |

Password rules: min 8 chars, at least 1 letter and 1 number.

### Projects (owner-scoped)

| Method | Path            | Query/Body                                   | Description              |
| ------ | --------------- | -------------------------------------------- | ------------------------ |
| POST   | `/projects`     | `{ name, niche?, description? }`             | Create project           |
| GET    | `/projects`     | `page? pageSize? order? search?`             | List own projects        |
| GET    | `/projects/:id` | —                                            | Get own project          |
| PATCH  | `/projects/:id` | `{ name?, niche?, description? }`            | Update own project       |
| DELETE | `/projects/:id` | —                                            | Delete own project       |
| POST   | `/projects/:id/demo-data` | —                                     | Clone the seed dataset into an owned project (idempotent) → `{ videos, metrics, hashtagLinks, creators, hashtags, scrapingJobs }` |
| POST   | `/projects/:id/scrape` | `{ keyword?, hashtag?, maxResults? }` | Queue a real scraping job for an owned project (falls back to the project niche as hashtag) → `ScrapingJob` (QUEUED) |

### Creators

| Method | Path           | Query/Body                          | Description                  |
| ------ | -------------- | ----------------------------------- | ---------------------------- |
| GET    | `/creators`    | `page? pageSize? order? search? sort?` | List creators (sort: `followers` default, `createdAt`, `totalVideos`) |
| GET    | `/creators/:id`| —                                   | Creator detail + `_count.videos` |

### Videos

| Method | Path         | Query/Body                                      | Description                            |
| ------ | ------------ | ----------------------------------------------- | -------------------------------------- |
| GET    | `/videos`    | `page? pageSize? order? projectId? search? sort?` | List videos (sort: `publishedAt` default, `duration`, `createdAt`, `views`, `likes`, `comments`, `shares`, `saves`). Metric sorts use latest snapshot. |
| GET    | `/videos/:id`| —                                               | Video + creator, metrics, hashtags, analyses |

### Hashtags

| Method | Path           | Query/Body            | Description                  |
| ------ | -------------- | --------------------- | ---------------------------- |
| GET    | `/hashtags`    | `projectId? top?`     | Top hashtags by video usage  |
| GET    | `/hashtags/:id`| —                     | Hashtag detail + videos      |

### Scraping jobs

| Method | Path                | Query/Body                                      | Description              |
| ------ | ------------------- | ----------------------------------------------- | ------------------------ |
| POST   | `/scraping-jobs`    | `{ projectId, keyword? hashtag?, maxResults? }` | Create job; enqueued to BullMQ, processed async |
| GET    | `/scraping-jobs`    | `page? pageSize? order? projectId? status?`     | List jobs                |
| GET    | `/scraping-jobs/:id`| —                                               | Job detail + results     |

`keyword` or `hashtag` is required.

### Trends

| Method | Path        | Query/Body                                              | Description        |
| ------ | ----------- | ------------------------------------------------------- | ------------------ |
| POST   | `/trends`   | `{ projectId, keyword, type?, periodStart? periodEnd?, opportunityScore?, searchVolume?, sources? }` | Create trend; omitted score fields are auto-computed from the project dataset |
| GET    | `/trends`   | `page? pageSize? order? projectId? type? from?`         | List trends        |
| GET    | `/trends/:id` | —                                                    | Trend detail       |

### Analytics (read-only)

| Method | Path                     | Query/Body                                  | Description                                      |
| ------ | ------------------------ | ------------------------------------------- | ------------------------------------------------ |
| GET    | `/analytics/overview`    | `projectId`                                 | Totals, averages, top video + creator            |
| GET    | `/analytics/engagement`  | `projectId`, `from? to? bucket?`            | Time series bucketed by publish date (`day`/`week`/`month`) |
| GET    | `/analytics/creators`    | `projectId`, `sort? limit?`                 | Leaderboard (`followers`/`engagement`/`views`)   |
| GET    | `/analytics/hashtags`    | `projectId`, `limit?`                       | Hashtag performance                              |
| GET    | `/analytics/trend-score` | `projectId`, `keyword? hashtag? periodDays?`| On-the-fly trend scoring (keyword or hashtag required) |
| GET    | `/analytics/opportunities` | `projectId`, `limit? (1-50, default 10)`  | Ranked content opportunities (destination / hashtag / topic / format / hook) with explainable scores |

See [docs/analytics.md](analytics.md) for the scoring model and examples.

### Semantic search (owner-scoped)

| Method | Path                                | Query/Body                                        | Description                                            |
| ------ | ----------------------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| GET    | `/semantic-search`                  | `projectId`, `q (min 2 chars)`, `entityTypes? (comma list of VIDEO,IDEA,TREND)`, `limit? (1-50, default 10)` | Rank indexed entities by cosine similarity to the query |
| GET    | `/semantic-search/meta`             | `projectId`                                       | Indexed-entity counts + embedding model name            |
| POST   | `/projects/:id/index-embeddings`    | —                                                 | (Re)index all videos, ideas and trends of the project (idempotent) |

- Embeddings are stored in a pgvector `Embedding` table (1536 dims) and generated
  by `@traveltok/ai` (mock hashed embeddings by default, `text-embedding-3-small`
  in `AI_MODE=openai`).
- `demo-data` automatically indexes the cloned videos.
- Every search/index request is scoped to a project owned by the caller (404
  otherwise).

### AI (video classification & insights)

| Method | Path                    | Description                                             |
| ------ | ----------------------- | ------------------------------------------------------- |
| POST   | `/videos/:id/analyze`   | Classify video, append a `ContentAnalysis` record       |
| GET    | `/videos/:id/analyses`  | `page? pageSize?` — analysis history                    |
| GET    | `/projects/:id/insights`| AI summary, strengths, recommendations, predicted best format/hook, opportunity score |

See [docs/ai.md](ai.md) for modes (`AI_MODE=mock` default / `openai`), prompts,
and validation.

### Content ideas

| Method | Path                  | Query/Body                                                       | Description        |
| ------ | --------------------- | ---------------------------------------------------------------- | ------------------ |
| POST   | `/content-ideas`      | `{ projectId, title, description?, format?, status?, opportunityScore? }` | Create idea |
| POST   | `/content-ideas/generate` | `{ projectId, count? (1-10, default 5), format? }`            | AI-generate ideas from project analytics/trends and persist them (`generatedBy: AI`) |
| POST   | `/content-ideas/:id/generate-script` | —                                          | AI-generate a script (hook + scene outline) and persist on the idea |
| POST   | `/content-ideas/:id/generate-caption` | —                                         | AI-generate a caption + hashtags and persist on the idea |
| GET    | `/content-ideas`      | `page? pageSize? order? projectId? status?`                      | List ideas         |
| GET    | `/content-ideas/:id`  | —                                                                | Idea detail        |
| PATCH  | `/content-ideas/:id`  | `{ title?, description?, format?, status?, opportunityScore? }`   | Update idea        |
| DELETE | `/content-ideas/:id`  | —                                                                | Delete idea        |

### Content plans & items

| Method | Path                           | Query/Body                                                    | Description        |
| ------ | ------------------------------ | ------------------------------------------------------------- | ------------------ |
| POST   | `/content-plans`               | `{ projectId, title, description?, startDate?, endDate?, status? }` | Create plan |
| POST   | `/content-plans/generate`      | `{ projectId, title?, startDate, endDate, postsPerWeek? (1-7, default 3), status? }` | AI-schedule the project's best ideas into a plan + items (`generatedBy: AI`, items prefill hook/script/caption) |
| GET    | `/content-plans`               | `page? pageSize? order? projectId?`                            | List plans         |
| GET    | `/content-plans/:id`           | —                                                             | Plan detail + items|
| PATCH  | `/content-plans/:id`           | `{ title?, description?, startDate?, endDate?, status? }`       | Update plan        |
| DELETE | `/content-plans/:id`           | —                                                             | Delete plan        |
| POST   | `/content-plans/:id/items`     | `{ title, description?, scheduledDate?, status?, videoId?, ideaId? }` | Add item   |
| PATCH  | `/content-plans/items/:itemId` | `{ title?, description?, scheduledDate?, status?, videoId?, ideaId? }` | Update item |
| DELETE | `/content-plans/items/:itemId` | —                                                             | Delete item        |

## Roadmap

- Phase 6: AI endpoints (video classification, AI project insights). ✅
- Phase 7: content-idea generation, scripts, captions, content planner. ✅
- Phase 8: web dashboard consuming this API, demo-data bootstrap. ✅
- Phase 9: embeddings, pgvector, semantic search, opportunity score. ✅
- Phase 10: testing, security, docs. ✅
