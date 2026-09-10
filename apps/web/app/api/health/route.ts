import { getPrisma } from "@/lib/server/prisma";
import { jsonResponse, ok } from "@/lib/server/http";

/** Always responds 200 while the process is up; per-dependency health in `checks`. */
export async function GET(): Promise<Response> {
  const startedAt = Date.now();
  let database: Record<string, unknown> = { status: "up", latencyMs: 0 };
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    database = { status: "up", latencyMs: Date.now() - startedAt };
  } catch (error) {
    database = {
      status: "down",
      message: error instanceof Error ? error.message : "Unknown database error",
    };
  }

  const redis = process.env.REDIS_URL
    ? { status: "not_configured", message: "Redis is no longer used by this deployment" }
    : { status: "not_configured", message: "REDIS_URL is not set" };

  const checks = { database, redis };
  const status = database.status === "up" ? "ok" : "degraded";

  return jsonResponse(
    200,
    ok({
      status,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      environment: process.env.NODE_ENV ?? "development",
      checks,
    }),
  );
}