# Analytics Engine

Phase 5 delivers read-only analytics over the scraped dataset. Everything is
computed on demand from the latest metric snapshot per video (`VideoMetric`
ordered by `collectedAt DESC`, one row per video). No denormalized tables, no
background jobs — the seed project (~120 videos, ~25 creators) stays fast, and
the queries are single aggregate `$queryRaw` calls.

All endpoints require JWT auth and scope to a single project via `projectId`.

## Endpoints

| Method | Path                          | Query params                              | Description                                    |
| ------ | ----------------------------- | ----------------------------------------- | ---------------------------------------------- |
| GET    | `/analytics/overview`         | `projectId`                               | Dashboard totals, averages, top video/creator  |
| GET    | `/analytics/engagement`       | `projectId`, `from?`, `to?`, `bucket?`    | Time series bucketed by publish date           |
| GET    | `/analytics/creators`         | `projectId`, `sort?`, `limit?`            | Creator leaderboard                            |
| GET    | `/analytics/hashtags`         | `projectId`, `limit?`                     | Hashtag performance                            |
| GET    | `/analytics/trend-score`      | `projectId`, `keyword?`, `hashtag?`, `periodDays?` | On-the-fly trend scoring (at least one of keyword/hashtag required) |

## Overview

`GET /analytics/overview?projectId=...`

```json
{
  "projectId": "…",
  "videoCount": 120,
  "creatorCount": 25,
  "hashtagCount": 60,
  "completedJobs": 2,
  "totalViews": 123456789,
  "totalLikes": 1234567,
  "totalComments": 23456,
  "totalShares": 3456,
  "totalSaves": 456,
  "avgViews": 1028806,
  "avgEngagementRate": 6.72,
  "videosLast30d": 41,
  "topVideo": { "id": "…", "caption": "…", "url": "…", "views": 5241234, "creatorUsername": "explore.id" },
  "topCreator": { "id": "…", "username": "wanderlust", "followers": 120000, "videoCount": 6 }
}
```

BigInt columns (views/likes/…) are already converted to JS numbers, and `null`
rows appear as `null` (e.g. an empty project).

## Engagement series

`GET /analytics/engagement?projectId=...&bucket=day|week|month`

Buckets videos by `publishedAt` (`date_trunc`) and aggregates the *latest*
metric snapshot of each video in the bucket. `from`/`to` filter on
`publishedAt` (ISO strings). Returns buckets sorted ascending:

```json
[
  { "bucket": "2026-07-01T00:00:00.000Z", "count": 12, "views": 1234567,
    "likes": 12345, "comments": 234, "shares": 345, "avgEngagementRate": 5.83 }
]
```

## Creator leaderboard

`GET /analytics/creators?projectId=...&sort=followers|engagement|views&limit=10`

Ranks creators who own videos in the project:

```json
[
  { "id": "…", "externalId": "author-1", "username": "explore.id",
    "displayName": "Explore Indonesia", "avatarUrl": "…", "followers": 240000,
    "videoCount": 6, "totalViews": 9234567, "avgViews": 1539094,
    "avgEngagementRate": 7.1 }
]
```

## Hashtag performance

`GET /analytics/hashtags?projectId=...&limit=10`

```json
[
  { "id": "…", "name": "#traveltok", "normalizedName": "traveltok",
    "videoCount": 41, "totalViews": 45678901, "avgEngagementRate": 6.4 }
]
```

## Trend score (detection)

`GET /analytics/trend-score?projectId=...&keyword=raja ampat` (or `hashtag=…`,
or both; `periodDays` defaults to 30).

The engine counts project videos matching the keyword (ILIKE on caption /
description / location) and/or an exact normalized hashtag, then derives five
0–100 components plus a weighted total:

| Component        | Formula                                        | Meaning                                   |
| ---------------- | ---------------------------------------------- | ----------------------------------------- |
| `growthRate`     | recent vs earlier window delta (%)             | momentum (can be negative)                |
| `growthScore`    | `clamp(growthRate / 2, 0, 100)`                | +200% growth → 100                        |
| `engagementScore`| `clamp(avgEngagementRate * 20, 0, 100)`        | 5% engagement → 100                       |
| `frequencyScore` | `clamp(matching/total * 200, 0, 100)`          | half the project covers it → 100          |
| `recencyScore`   | share of matches published in the last period  | freshness                                 |
| `contentGapScore`| share of niche not yet covered by your creators| 100 = untouched opportunity              |

`trendScore` is the weighted sum using the `TREND_WEIGHT_*` env vars (defaults:
growth 0.30, engagement 0.25, frequency 0.20, recency 0.15, content gap 0.10).
`opportunityScore = 0.85 * trendScore + 0.15 * contentGapScore`.

With zero matching videos the trend/opportunity scores are deliberately `0`
(no scraped evidence → no signal), while `contentGapScore` stays at `100`.

### Wiring into Trends

`POST /trends` now auto-scores the keyword: any score field omitted from the
request is filled from `TrendScoreService.score()` against the project's
dataset (explicit values in the request win). See `apps/api/src/analytics/`.

## Opportunities (content gap)

`GET /analytics/opportunities?projectId&limit` returns the highest-potential
content angles in a project's dataset. Every segment found — destination,
hashtag, topic, format, hook — is scored from three explainable components:

```
demand      = coverage ratio (prevalence of the segment)
engagement  = average engagement rate vs the best segment
growth      = matching Trend.trendScore when present (modest default 40)

opportunity = 0.4·demand + 0.35·engagement + 0.25·growth  →  0..100
```

Each opportunity carries its component scores, coverage evidence, a human
readable `reasoning`, and the top performing videos in that segment.

## Implementation notes

- `apps/api/src/analytics/analytics.service.ts` — aggregate queries
  (`overview`, `engagement`, `topCreators`, `hashtagPerformance`). All use a
  shared `latestMetricCte` resolving the newest snapshot per video.
- `apps/api/src/analytics/trend-score.service.ts` — pure scoring math
  (`computeTrendScores`) + Prisma-based dataset queries. The pure function is
  unit tested (`trend-score.service.spec.ts`).
- `apps/api/src/analytics/opportunity.service.ts` — deterministic opportunity
  detection/scoring over the same dataset queries (e2e tested).
- `apps/api/src/common/utils/hashtags.ts` — shared `normalizeHashtag`.
- Sorting in raw SQL is allowlisted (never interpolates user input into
  `ORDER BY`).
