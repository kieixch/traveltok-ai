import { Module } from "@nestjs/common";
import { ScrapingQueueService } from "./scraping-queue.service";

/**
 * API-side scraping module: exposes the BullMQ producer only. The worker that
 * consumes the queue runs in a separate process (ScrapingWorkerModule).
 */
@Module({
  providers: [ScrapingQueueService],
  exports: [ScrapingQueueService],
})
export class ScrapingModule {}
