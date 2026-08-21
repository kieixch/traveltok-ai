import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ScrapingWorkerModule } from "./scraping/scraping-worker.module";

/**
 * Standalone BullMQ worker process entry point.
 * Run: npm run start:worker (compiled) | start:worker:dev (ts-node).
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger("ScrapingWorker");
  const app = await NestFactory.createApplicationContext(ScrapingWorkerModule, {
    logger: ["log", "warn", "error"],
  });
  await app.init();
  logger.log("Scraping worker started. Press Ctrl+C to stop.");

  const shutdown = async (): Promise<void> => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error: unknown) => {
  console.error("Scraping worker failed to start:", error);
  process.exit(1);
});
