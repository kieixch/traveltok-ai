import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../auth/types";
import { AiAnalysisService } from "./ai-analysis.service";
import { ProjectInsightsService } from "./project-insights.service";
import { AiRuntimeService } from "./ai-runtime.service";
import { UpdateAiProviderDto } from "./dto/update-ai-provider.dto";
import { UpdateAiModelDto } from "./dto/update-ai-model.dto";

@Controller()
export class AiController {
  constructor(
    private readonly aiAnalysisService: AiAnalysisService,
    private readonly projectInsightsService: ProjectInsightsService,
    private readonly aiRuntimeService: AiRuntimeService,
  ) {}

  @Get("ai/providers")
  providers(@CurrentUser() user: AuthUser) {
    return this.aiRuntimeService.providersInfo(user.userId);
  }

  @Put("ai/provider")
  setProvider(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateAiProviderDto,
  ) {
    return this.aiRuntimeService.setProvider(user.userId, dto.provider);
  }

  @Put("ai/model")
  setModel(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateAiModelDto,
  ) {
    return this.aiRuntimeService.setModel(user.userId, dto.provider, dto.model);
  }

  @Post("videos/:id/analyze")
  analyzeVideo(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.aiAnalysisService.analyzeVideo(user.userId, id);
  }

  @Get("videos/:id/analyses")
  listAnalyses(@Param("id") id: string, @Query() query: PaginationQueryDto) {
    return this.aiAnalysisService.listAnalyses(id, query.page, query.pageSize);
  }

  @Get("projects/:id/insights")
  projectInsights(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.projectInsightsService.insights(user.userId, id);
  }
}
