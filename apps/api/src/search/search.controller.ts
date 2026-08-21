import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../auth/types";
import { EMBEDDING_ENTITY_TYPES } from "./embeddings.service";
import { EmbeddingsService } from "./embeddings.service";
import { SemanticSearchService } from "./semantic-search.service";
import {
  IndexMetaQueryDto,
  SemanticSearchQueryDto,
} from "./dto/semantic-search-query.dto";

@Controller("semantic-search")
export class SemanticSearchController {
  constructor(private readonly semanticSearchService: SemanticSearchService) {}

  @Get()
  search(
    @CurrentUser() user: AuthUser,
    @Query() query: SemanticSearchQueryDto,
  ) {
    return this.semanticSearchService.search({
      userId: user.userId,
      projectId: query.projectId,
      query: query.q,
      entityTypes: query.entityTypes ?? EMBEDDING_ENTITY_TYPES,
      limit: query.limit ?? 10,
    });
  }

  @Get("meta")
  meta(@CurrentUser() user: AuthUser, @Query() query: IndexMetaQueryDto) {
    return this.semanticSearchService.meta(user.userId, query.projectId);
  }
}

@Controller("projects")
export class SearchProjectsController {
  constructor(private readonly embeddingsService: EmbeddingsService) {}

  @Post(":id/index-embeddings")
  indexEmbeddings(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.embeddingsService.indexProject(user.userId, id);
  }
}
