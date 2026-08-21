# Security

TravelTok AI follows a layered security model. This document describes the
controls that are enforced by default and how to tighten them for production.

## Authentication & authorization

- Passwords are hashed with **bcrypt (10 rounds)**; only the hash is stored.
  The hash is never serialized in API responses (`AuthService.toSafeUser`
  strips `passwordHash`).
- **JWT** bearer tokens (HS256) authenticate requests. `JWT_SECRET` is
  required — the API refuses to boot without it, and refuses to boot with a
  weak secret (< 32 characters) in `NODE_ENV=production` (warns otherwise).
- The `JwtAuthGuard` is registered globally via `APP_GUARD`; every route is
  protected by default unless marked `@Public()` (only `/health`,
  `/auth/register`, `/auth/login`).
- A `RolesGuard` enforces `@Roles("ADMIN")` where used.
- Project-scoped resources enforce ownership (creator must own the project),
  returning `404 NOT_FOUND` for foreign resources so existence is not leaked.

## Input validation

- A global `ValidationPipe` (whitelist + transform + `forbidNonWhitelisted`)
  rejects unknown, malformed or out-of-range payloads with
  `400 VALIDATION_ERROR` before any handler runs.
- All AI-generated content is validated with **Zod** before touching the
  database (see [docs/ai.md](ai.md)).

## Transport hardening

- **Helmet** security headers are applied in `main.ts`:
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
  a Content-Security-Policy, `Referrer-Policy`, and more.
- **CORS** is configured from `CORS_ORIGINS` (comma-separated). Missing or `*`
  reflects any origin (dev convenience); production should list exactly the
  web app origin(s), e.g. `CORS_ORIGINS=https://app.example.com`.

## Rate limiting

`@nestjs/throttler` is applied globally:

- Global: `RATE_LIMIT_GLOBAL_LIMIT` (default `300`) per
  `RATE_LIMIT_TTL_SECONDS` (default `60`) per IP.
- Auth routes (`/auth/*`) are stricter: `10` requests / 60s / IP to slow
  credential stuffing and account enumeration.
- `RATE_LIMIT_DISABLED=true` disables throttling entirely (used by the e2e
  suite only — never in production).

## Secrets

- API keys (`OPENAI_API_KEY`, `APIFY_API_TOKEN`) are backend-only and never
  sent to the browser. `NEXT_PUBLIC_API_URL` is the only frontend-visible
  secret-adjacent variable, and it is safe to expose.
- Copy `.env.example` to `.env`; real secrets are never committed.

## Known limits

- No refresh tokens / rotation; a leaked token is valid until `JWT_EXPIRES_IN`.
- No per-account brute-force lockout (IP-based rate limiting only).
- CORS with `credentials: true` requires explicit origins in production (never
  `*` in that mode).
- The e2e suite shares one database and runs suites in parallel; it is
  therefore excluded from rate limiting (`RATE_LIMIT_DISABLED=true`).

See [docs/testing.md](testing.md) for how the security controls are tested.
