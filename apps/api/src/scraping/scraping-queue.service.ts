import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { createBullConnectionOptions } from "./redis-connection";
import {
  SCRAPING_JOB_NAME,
  SCRAPING_QUEUE_NAME,
  ScrapingJobPayload,
} from "./types";

/**
 * BullMQ producer used by the API to enqueue scraping jobs. The queue and its
 * Redis connection are created lazily on first use (env is loaded by then).
 * When Redis is not configured the API still records the job as QUEUED and
 * skips enqueueing.
 */
@Injectable()
export class ScrapingQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(ScrapingQueueService.name);
  private queue: Queue | null | undefined;

  async enqueue(scrapingJobId: string): Promise<boolean> {
    const queue = this.getQueue();
    if (!queue) {
      this.logger.warn("Redis not configured — scraping job not enqueued");
      return false;
    }
    const payload: ScrapingJobPayload = { scrapingJobId };
    await queue.add(SCRAPING_JOB_NAME, payload, {
      jobId: scrapingJobId,
      removeOnComplete: 200,
      removeOnFail: 500,
    });
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = undefined;
    }
  }

  private getQueue(): Queue | null {
    if (this.queue !== undefined) {
      return this.queue;
    }
    const url = process.env.REDIS_URL;
    if (!url) {
      this.queue = null;
      return null;
    }
    this.queue = new Queue(SCRAPING_QUEUE_NAME, {
      connection: createBullConnectionOptions(url),
    });
    return this.queue;
  }
}
