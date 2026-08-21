import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

/**
 * Shared Prisma client for TravelTok AI.
 *
 * Prisma ORM v7 requires a driver adapter. We use `@prisma/adapter-pg` with
 * the connection URL from the environment. The client connects lazily, so the
 * application can boot even if PostgreSQL is temporarily unavailable (the
 * `/health` endpoint reports connectivity).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env at the repository root.",
      );
    }

    // Local development PostgreSQL runs without TLS. Enable SSL only when
    // explicitly requested (e.g. managed/cloud PostgreSQL).
    const ssl =
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined;

    const adapter = new PrismaPg({ connectionString, ssl });

    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect().catch((error: unknown) => {
      this.logger.error(`Failed to disconnect Prisma client: ${String(error)}`);
    });
  }
}
