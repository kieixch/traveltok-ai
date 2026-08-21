import type { ConnectionOptions } from "bullmq";

/**
 * Builds BullMQ connection options from a redis:// URL. BullMQ owns the
 * resulting connection (creates and closes it), which keeps the worker's
 * blocking commands from interfering with the API's shared client.
 */
export function createBullConnectionOptions(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || "6379"),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname !== "/" ? Number(parsed.pathname.slice(1)) || 0 : 0,
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
  };
}
