import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "@traveltok/database";
import { join } from "node:path";
import { ScrapingService } from "./scraping.service";
import { TikTokScraperFactory } from "./tiktok-scraper.factory";
import { ScrapingWorkerService } from "./scraping-worker.service";

/**
 * Bootstrap module for the standalone scraping worker process. Unlike the API
 * AppModule it starts a BullMQ Worker (not an HTTP server). Run with:
 * `npm run start:worker` (compiled) or `start:worker:dev` (ts-node).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), "../../.env"),
        join(process.cwd(), ".env"),
      ],
    }),
    DatabaseModule,
  ],
  providers: [
    TikTokScraperFactory,
    ScrapingService,
    ScrapingWorkerService,
  ],
})
export class ScrapingWorkerModule {}
