import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/**
 * Wraps the shared ioredis connection. Used for health checks today and by
 * BullMQ queues/workers from Phase 4 onwards.
 *
 * The client is configured with:
 * - `lazyConnect`: never connect until the first command is issued.
 * - `enableOfflineQueue: false`: commands fail fast when disconnected, so
 *   health checks and callers do not hang on a dead Redis.
 * - `maxRetriesPerRequest: null`: required by BullMQ.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn("REDIS_URL is not set. Redis features are disabled.");
      this.client = null;
      return;
    }

    this.client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
  }

  /** Returns "PONG" when Redis is reachable, otherwise null. */
  async ping(): Promise<string | null> {
    if (!this.client) {
      return null;
    }
    try {
      // With `lazyConnect`, the client is not connected yet. Commands issued
      // while disconnected are rejected when `enableOfflineQueue` is false,
      // so connect explicitly before the first command.
      if (this.client.status === "wait" || this.client.status === "end") {
        await this.client.connect();
      }
      const reply = await this.client.ping();
      return reply === "PONG" ? "PONG" : null;
    } catch (error) {
      this.logger.error(`Redis ping failed: ${String(error)}`);
      return null;
    }
  }

  /** The underlying ioredis instance, or null when not configured. */
  get raw(): Redis | null {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        if (this.client.status === "ready" || this.client.status === "connecting") {
          await this.client.quit();
        } else {
          // Lazy client never opened a connection — `quit()` would reject
          // ("Stream isn't writeable..."), so destroy the socket directly.
          this.client.disconnect();
        }
      } catch (error) {
        this.logger.error(`Failed to quit Redis: ${String(error)}`);
      }
    }
  }
}
