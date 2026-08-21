// Runs before every e2e worker process imports any spec module.
// The test suite shares one database and one app process per worker, so
// rate limiting is disabled unless a spec explicitly re-enables it.
process.env.RATE_LIMIT_DISABLED = "true";
process.env.NODE_ENV = "test";
// E2E specs assert deterministic mock providers, so force the mock AI mode
// regardless of the local .env (AI_MODE=gemini would hit real APIs and
// flaky rate limits).
process.env.AI_MODE = "mock";
