import { Module } from "@nestjs/common";
import { DatabaseModule } from "@traveltok/database";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { TrendScoreService } from "./trend-score.service";
import { OpportunityService } from "./opportunity.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, TrendScoreService, OpportunityService],
  exports: [AnalyticsService, TrendScoreService],
})
export class AnalyticsModule {}
