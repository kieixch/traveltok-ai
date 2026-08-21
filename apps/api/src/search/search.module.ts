import { Module } from "@nestjs/common";
import { DatabaseModule } from "@traveltok/database";
import { AiModule } from "../ai/ai.module";
import { EmbeddingsService } from "./embeddings.service";
import { SemanticSearchService } from "./semantic-search.service";
import { SemanticSearchController, SearchProjectsController } from "./search.controller";

@Module({
  imports: [DatabaseModule, AiModule],
  controllers: [SemanticSearchController, SearchProjectsController],
  providers: [EmbeddingsService, SemanticSearchService],
  exports: [EmbeddingsService, SemanticSearchService],
})
export class SearchModule {}
