import { Injectable } from "@nestjs/common";
import type { HealthCheckResult, ServiceHealthCheck } from "@traveltok/types";
import { PrismaService } from "@traveltok/database";
import { RedisService } from "../redis/redis.service";

/**
 * Reports the health of the API and its infrastructure dependencies.
 *
 * The endpoint always responds 200 as long as the API process itself is up;
 * individual service health is reported in `checks`. This lets the app boot
 * (and the dashboard render) even when a dependency is temporarily down.
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async checkDatabase(): Promise<ServiceHealthCheck> {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "up", latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        status: "down",
        message: error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealthCheck> {
    if (!process.env.REDIS_URL) {
      return { status: "not_configured", message: "REDIS_URL is not set" };
    }

    const startedAt = Date.now();
    const pong = await this.redis.ping();
    if (pong === "PONG") {
      return { status: "up", latencyMs: Date.now() - startedAt };
    }
    return { status: "down", message: "Redis did not reply to PING" };
  }

  async check(): Promise<HealthCheckResult> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const checks = { database, redis };
    const status =
      database.status === "up" && redis.status === "up" ? "ok" : "degraded";

    return {
      status,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      environment: process.env.NODE_ENV ?? "development",
      checks,
    };
  }
}
