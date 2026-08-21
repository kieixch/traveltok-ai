/**
 * Resolves CORS origins from `CORS_ORIGINS` (comma-separated).
 * `*`, empty, or missing → reflect any origin (dev convenience).
 * Otherwise only the listed origins are allowed.
 */
export function buildCorsOrigins(): boolean | string[] {
  const raw = process.env.CORS_ORIGINS;
  if (!raw || raw.trim() === "*") return true;
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
