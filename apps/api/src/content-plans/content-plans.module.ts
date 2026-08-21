import { Module } from "@nestjs/common";
import { DatabaseModule } from "@traveltok/database";
import { AiModule } from "../ai/ai.module";
import { ContentPlansController } from "./content-plans.controller";
import { ContentPlansService } from "./content-plans.service";
import { PlanGenerationService } from "./plan-generation.service";

@Module({
  imports: [DatabaseModule, AiModule],
  controllers: [ContentPlansController],
  providers: [ContentPlansService, PlanGenerationService],
})
export class ContentPlansModule {}
