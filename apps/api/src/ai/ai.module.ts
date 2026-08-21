import { Module } from "@nestjs/common";
import { DatabaseModule } from "@traveltok/database";
import { AnalyticsModule } from "../analytics/analytics.module";
import { parseAIConfig } from "@traveltok/ai";
import { AI_CONFIG } from "./ai.constants";
import { AiAnalysisService } from "./ai-analysis.service";
import { ProjectInsightsService } from "./project-insights.service";
import { AiRuntimeService } from "./ai-runtime.service";
import { AiController } from "./ai.controller";

@Module({
  imports: [DatabaseModule, AnalyticsModule],
  controllers: [AiController],
  providers: [
    AiAnalysisService,
    ProjectInsightsService,
    AiRuntimeService,
    { provide: AI_CONFIG, useFactory: () => parseAIConfig(process.env) },
  ],
  exports: [AI_CONFIG, AiRuntimeService],
})
export class AiModule {}
