import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";
import { createBullConnectionOptions } from "./redis-connection";
import { ScrapingService } from "./scraping.service";
import { SCRAPING_QUEUE_NAME, ScrapingJobPayload } from "./types";

/**
 * Starts a BullMQ worker consuming the scraping queue. Each completed job runs
 * ScrapingService.process which persists normalized results and marks the job
 * COMPLETED (or FAILED on error). The worker uses its own Redis connection so
 * blocking commands never interfere with the API process.
 */
@Injectable()
export class ScrapingWorkerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ScrapingWorkerService.name);
  private worker: Worker | null = null;

  constructor(
    private readonly scrapingService: ScrapingService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const url = this.config.get<string>("REDIS_URL");
    if (!url) {
      this.logger.warn("REDIS_URL not set — scraping worker disabled");
      return;
    }

    this.worker = new Worker(
      SCRAPING_QUEUE_NAME,
      async (job) => {
        const payload = job.data as ScrapingJobPayload;
        return this.scrapingService.process(payload.scrapingJobId);
      },
      {
        connection: createBullConnectionOptions(url),
        concurrency: 2,
      },
    );

    this.worker.on("completed", (job) => {
      this.logger.log(`Scraping job ${job.id} completed`);
    });
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `Scraping job ${job?.id ?? "?"} failed: ${error.message}`,
      );
    });

    await this.worker.waitUntilReady();
    this.logger.log(`Scraping worker listening on queue "${SCRAPING_QUEUE_NAME}"`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
