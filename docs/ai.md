# AI

> Phase 6-7 — classification, project insights, content idea/script/caption
> generation, and the AI content planner are live behind a pluggable
> **mock/openai** mode. Real OpenAI calls require `OPENAI_API_KEY`; without one the
> system degrades to a deterministic mock (same as scraping).

## Modes

| Env var        | Values        | Effect                                             |
| -------------- | ------------- | -------------------------------------------------- |
| `AI_MODE`      | `mock` (default) / `openai` | `openai` is only effective when `OPENAI_API_KEY` is set; otherwise it degrades to `mock` |
| `OPENAI_API_KEY` | —           | API key for real calls (kept server-side only)     |
| `OPENAI_MODEL` | `gpt-4o-mini` default | Model used for classification and insights  |
| `OPENAI_BASE_URL` | —        | Optional override for OpenAI-compatible endpoints   |

The mode is resolved once at module init by `parseAIConfig(process.env)` in
`packages/ai/src/config.ts` and shared via the `AI_CONFIG` DI token.

## Package `@traveltok/ai`

Shared, framework-agnostic AI utilities (`packages/ai`):

- `config.ts` — `parseAIConfig` (mode resolution, model, base URL)
- `types.ts` — content format / hook type / sentiment / intent / CTA constants
- `zod-schemas.ts` — `VideoClassificationSchema` + `validateVideoClassification` (throws `AIClassificationError` on invalid output)
- `prompts.ts` — versioned system prompts (`video-classifier` v1, `project-insights` v1)
- `mock-classifier.ts` — deterministic `MockVideoClassifier` (regex/heuristics)
- `openai-classifier.ts` — `OpenAIVideoClassifier` (`response_format: json_object` + zod validation)
- `video-classifier.ts` — `createVideoClassifier` factory (mock/openai)
- `project-insights.ts` — `MockProjectInsights` / `OpenAIProjectInsights` + `createInsightsGenerator`
- `index.ts` — public exports

## Endpoints

| Method | Path                    | Description                                             |
| ------ | ----------------------- | ------------------------------------------------------- |
| POST   | `/videos/:id/analyze`   | Classify a video and append a `ContentAnalysis` record |
| GET    | `/videos/:id/analyses`  | Paginated analysis history for a video                  |
| GET    | `/projects/:id/insights`| AI summary/strengths/recommendations for a project (mock is deterministic) |

`POST /videos/:id/analyze` returns a validated `VideoClassification` and persists it
as a `ContentAnalysis` row (`analysisVersion`, `model`, `rawJson`, `createdAt`).
Repeated calls append — history is never overwritten.

Insights combine AI output with the Phase 5 analytics engine (`AnalyticsService`
injected into `AiModule`), producing `summary`, `strengths`, `recommendations`,
`predictedBestFormat`, `predictedBestHook`, and an `opportunity` score.

## Content generation (Phase 7)

All generators follow the same pluggable **mock/openai** pattern as classification
and insights, share the `AI_CONFIG` token, and validate output with zod before any
write to PostgreSQL.

### Idea generation

| Method | Path                           | Description                                             |
| ------ | ------------------------------ | ------------------------------------------------------- |
| POST   | `/content-ideas/generate`      | Generate `count` ideas (default 5, max 10); optional `format` filter |
| POST   | `/content-ideas/:id/generate-script`  | Script (hook + timed scene outline) persisted on the idea |
| POST   | `/content-ideas/:id/generate-caption` | Caption + hashtags + CTA persisted on the idea         |

Idea generation feeds the project's analytics (top hashtags via
`AnalyticsService`, top destinations from `ContentAnalysis`) plus the predicted
best format from the Phase 6 insights generator into `MockContentIdeaGenerator`
(deterministic templates) or `OpenAIContentIdeaGenerator`. Ideas are persisted
with `generatedBy: "AI"`, `aiModel`, and `rawJson`.

### Planner

| Method | Path                        | Description                                             |
| ------ | --------------------------- | ------------------------------------------------------- |
| POST   | `/content-plans/generate`   | Schedule the project's best ideas into a plan + items   |

The planner ranks ideas by `opportunityScore`, computes the number of slots from
`startDate`/`endDate` and `postsPerWeek`, and creates a plan (`generatedBy: "AI"`)
with items that prefill `hook`, `script`, `caption`, `hashtags`, `cta`, and
`format` from each idea. Errors are surfaced as 400 (no ideas / inverted range).

### Embeddings

| Path                              | Description                                             |
| --------------------------------- | ------------------------------------------------------- |
| `POST /projects/:id/index-embeddings` | (Re)index all videos, ideas and trends of the project |
| `GET /semantic-search`            | Rank indexed entities by cosine similarity to the query |

Embeddings power pgvector semantic search. `MockEmbeddingGenerator` produces a
deterministic hashed bag-of-tokens vector (dimension 1536, model
`mock-hash-embedding`); `OpenAIEmbeddingGenerator` uses
`text-embedding-3-small` (`OPENAI_EMBEDDING_MODEL`, default dims 1536). Vectors
are stored in the `Embedding` table via raw SQL — Prisma cannot write
`Unsupported` columns — so queries run with `<=>` cosine distance directly.

## Validation & safety

- Every AI response is validated with Zod **before** anything is written to
  PostgreSQL; invalid output raises `AIClassificationError` and never corrupts data.
- OpenAI is only ever called from the backend; the API key never reaches the browser.
- Mock classifier is deterministic and unit-tested; tests cover the OpenAI path via
  the zod validation (no network calls).

## Roadmap

- Phase 8: web dashboard consuming this API.
- Phase 9: embeddings for semantic search (pgvector). ✅
- Phase 10: test hardening, security, docs polish.
