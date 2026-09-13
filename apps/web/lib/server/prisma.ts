import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@traveltok/database";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env at the repository root.",
    );
  }

  const ssl =
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined;

  const adapter = new PrismaPg({ connectionString, ssl });
  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrisma();
  }
  return globalForPrisma.prisma;
}

/** True for transient pool/connection failures (cold starts, stale idle sockets). */
export function isRetryableDbError(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code);
    if (["P1001", "P1002", "P2010", "P2024"].includes(code)) return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /(can't reach database|connection\s+(timed out|terminated|reset|refused)|socket hang up|pool\s+.+timeout|timeout exceeded|ECONNREFUSED|ETIMEDOUT)/i.test(
    message,
  );
}

/** Drops the cached client so the next getPrisma() builds a fresh pool. */
export async function resetPrisma(): Promise<void> {
  const client = globalForPrisma.prisma;
  globalForPrisma.prisma = undefined;
  if (client) {
    await client.$disconnect().catch(() => undefined);
  }
}