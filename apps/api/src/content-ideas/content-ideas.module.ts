import { Module } from "@nestjs/common";
import { DatabaseModule } from "@traveltok/database";
import { AnalyticsModule } from "../analytics/analytics.module";
import { AiModule } from "../ai/ai.module";
import { ContentIdeasController } from "./content-ideas.controller";
import { ContentIdeasService } from "./content-ideas.service";
import { ContentGenerationService } from "./content-generation.service";

@Module({
  imports: [DatabaseModule, AnalyticsModule, AiModule],
  controllers: [ContentIdeasController],
  providers: [ContentIdeasService, ContentGenerationService],
})
export class ContentIdeasModule {}
