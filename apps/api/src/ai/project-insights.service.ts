import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@traveltok/database";
import {
  createInsightsGenerator,
  ProjectInsight,
} from "@traveltok/ai";
import { AnalyticsService } from "../analytics/analytics.service";
import { AI_CONFIG } from "./ai.constants";
import { AiRuntimeService } from "./ai-runtime.service";
import type { AIConfig } from "@traveltok/ai";

@Injectable()
export class ProjectInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    @Inject(AI_CONFIG) private readonly config: AIConfig,
    private readonly runtime: AiRuntimeService,
  ) {}

  /** Aggregates project analytics and asks the AI engine for a strategy review. */
  async insights(userId: string, projectId: string): Promise<ProjectInsight> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const overview = await this.analytics.overview(projectId);
    const hashtags = await this.analytics.hashtagPerformance(projectId, 5);
    const mode = await this.runtime.modeFor(userId);
    const model = await this.runtime.modelFor(userId, mode);
    const generator = createInsightsGenerator(this.config, mode, model);

    return generator.generate({
      projectName: project.name,
      videoCount: overview.videoCount,
      creatorCount: overview.creatorCount,
      totalViews: overview.totalViews,
      avgEngagementRate: overview.avgEngagementRate,
      topCreator: overview.topCreator?.username ?? null,
      topHashtags: hashtags.map((h) => h.name),
      periodDays: 30,
    });
  }
}
