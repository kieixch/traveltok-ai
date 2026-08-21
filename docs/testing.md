# Testing

## Commands

```bash
npm run lint                  # ESLint, all workspaces
npm run typecheck             # tsc --noEmit, all workspaces
npm run build                 # packages → api → web
npm test                      # unit tests, all workspaces (57 in @traveltok/api)
npm run test:e2e -w @traveltok/api   # full API e2e suite
```

## What is covered

- **Unit tests** (`*.spec.ts`, run with `jest`): pure logic — auth service,
  trend scoring, pagination, AI mock generators/validators, and more.
- **E2E tests** (`apps/api/test/*.e2e-spec.ts`, run with `jest-e2e.json`):
  boot the real `AppModule` against the live PostgreSQL database and assert
  the HTTP contract — auth, CRUD, scraping jobs, trends, analytics,
  demo-data, AI, semantic search, opportunities, and security hardening
  (helmet headers, CORS, rate limiting, password-hash privacy).

## Stability notes

- E2E suites run in **parallel worker processes** against a shared database.
  This has caused cross-suite races in the past; rules learned:
  - Global (non project-scoped) rows created by a spec must be cleaned up by
    that spec (e.g. the search spec deletes its creator *after* deleting its
    user, because videos cascade from the project).
  - Assertions that depend on absolute ordering of shared datasets tolerate
    concurrent inserts (see the creator-sort check in `crud.e2e-spec.ts`).
  - Each test file runs in its own worker process, so a spec may safely set
    `process.env` before building its app (used by `security.e2e-spec.ts` to
    re-enable rate limiting and restrict CORS).
- `RATE_LIMIT_DISABLED=true` is set in `test/setup-e2e.ts` (runs before every
  spec) so throttling never flakes a test; `security.e2e-spec.ts` opts back in.
- `forceExit: true` is set; Jest's "worker process has failed to exit
  gracefully" warning is expected and harmless (the Nest app keeps a few
  handles open).

## Security tests

`security.e2e-spec.ts` builds its own app (with the same wiring as
`main.ts`: helmet + CORS + validation) and asserts:

- security headers are present,
- an allow-listed CORS origin is reflected on preflight,
- a non-listed origin is not reflected,
- `/auth` returns `429` once the auth limit is exceeded,
- non-auth endpoints stay under the generous global limit,
- `passwordHash` never appears in responses.
