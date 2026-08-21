# Scraping

> Status: **Phase 4 — implemented.** Scraping runs asynchronously via BullMQ.
> The default `SCRAPING_MODE=mock` produces deterministic mock data so the whole
> pipeline works without Apify credentials. Set `SCRAPING_MODE=apify` (plus
> `APIFY_API_TOKEN` and `APIFY_TIKTOK_ACTOR_ID`) to scrape real TikTok data.

## Flow

```
POST /scraping-jobs
  → validate → create ScrapingJob (QUEUED) → enqueue BullMQ job → respond immediately
Worker (npm run dev:worker)
  → load job → scraper (Apify or mock) → normalize → upsert creators/videos/hashtags
  → insert metric snapshot → mark job COMPLETED / FAILED
```

- HTTP requests never block: the API only creates the record and enqueues.
- Secrets (`APIFY_API_TOKEN`) live only in the backend worker — never in the
  frontend.

## Running

```bash
npm run dev:worker        # starts the BullMQ worker (ts-node)
npm run start:worker -w @traveltok/api   # compiled worker (node dist/worker.js)
```

The worker and the API each open their own Redis connection, so the worker's
blocking commands never interfere with API requests.

## Configuration

| Variable                | Default | Purpose                                              |
| ----------------------- | ------- | ---------------------------------------------------- |
| `REDIS_URL`             | —       | Required for queues. Missing → jobs stay QUEUED only |
| `SCRAPING_MODE`         | `mock`  | `mock` (deterministic fake data) or `apify`          |
| `APIFY_API_TOKEN`       | —       | Apify API token (real scraping)                      |
| `APIFY_TIKTOK_ACTOR_ID` | —       | TikTok actor to run                                  |
| `maxResults`            | 20      | Per-job video limit (1–500 via API)                  |

When `SCRAPING_MODE=mock` (or credentials are absent), the worker uses
`TikTokMockScraper`, a deterministic generator seeded from the job's
keyword/hashtag — re-runs are stable and it never touches Apify.

## Adapter layers

```
TikTokScraperFactory ─► TikTokScraper (ApifyClient + actor run + dataset)
                        TikTokMockScraper (dev)
                            │
                            ▼
                      TikTokDataMapper (raw item → internal DTO)
                            │
                            ▼
                      ScrapingService (upsert + metric snapshot + status)
```

- `TikTokDataMapper` reads several known Apify item shapes (`stats`,
  `author`/`authorMeta`, `challenges`/`textExtra`, `createTime`/`timestamp`,
  ...) and is tolerant of missing fields.
- Persistence is transactional: creator → video → metric snapshot → hashtag
  links. `externalId` dedupes creators and videos across runs; metrics are
  never overwritten (one snapshot per job, unique per `videoId + collectedAt`).
- A job is marked `COMPLETED` with `totalResults`/`processedResults`, or
  `FAILED` with `errorMessage` (the error is rethrown so BullMQ records it too).

## Status transitions

`QUEUED → RUNNING → COMPLETED` (or `FAILED`). A `CANCELLED` job is skipped by
the worker. Jobs are filterable by `projectId` and `status` via the API.

## API notes

- `POST /scraping-jobs` requires `keyword` or `hashtag`.
- If Redis is down, enqueue fails and the job is marked `FAILED` with the
  enqueue error instead of hanging forever.
