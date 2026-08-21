import { Module } from "@nestjs/common";
import { DatabaseModule } from "@traveltok/database";
import { ScrapingModule } from "../scraping/scraping.module";
import { ScrapingJobsController } from "./scraping-jobs.controller";
import { ScrapingJobsService } from "./scraping-jobs.service";

@Module({
  imports: [DatabaseModule, ScrapingModule],
  controllers: [ScrapingJobsController],
  providers: [ScrapingJobsService],
  exports: [ScrapingJobsService],
})
export class ScrapingJobsModule {}
