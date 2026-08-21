import { Module } from "@nestjs/common";
import { DatabaseModule } from "@traveltok/database";
import { SearchModule } from "../search/search.module";
import { ScrapingJobsModule } from "../scraping-jobs/scraping-jobs.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [DatabaseModule, SearchModule, ScrapingJobsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
