import { Module } from "@nestjs/common";
import { DatabaseModule } from "@traveltok/database";
import { AnalyticsModule } from "../analytics/analytics.module";
import { TrendsController } from "./trends.controller";
import { TrendsService } from "./trends.service";

@Module({
  imports: [DatabaseModule, AnalyticsModule],
  controllers: [TrendsController],
  providers: [TrendsService],
})
export class TrendsModule {}
