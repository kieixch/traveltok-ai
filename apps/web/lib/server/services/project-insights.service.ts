import { getPrisma } from "@/lib/server/prisma";
import { notFound } from "@/lib/server/http";
import { createInsightsGenerator, type AIConfig, type ProjectInsight } from "@traveltok/ai";
import { getAIConfig } from "@/lib/server/ai";
import { analyticsService } from "./analytics.service";
import { aiRuntimeService } from "./ai-runtime.service";
import { requireOwnedProject } from "@/lib/server/authz";

class ProjectInsightsService {
  private readonly config: AIConfig;

  constructor() {
    this.config = getAIConfig();
  }

  /** Aggregates project analytics and asks the AI engine for a strategy review. */
  async insights(userId: string, projectId: string): Promise<ProjectInsight> {
    await requireOwnedProject(userId, projectId);
    const project = await getPrisma().project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    if (!project) {
      throw notFound("Project not found");
    }

    const overview = await analyticsService.overview(projectId, userId);
    const hashtags = await analyticsService.hashtagPerformance(projectId, 5, userId);
    const mode = await aiRuntimeService.modeFor(userId);
    const model = await aiRuntimeService.modelFor(userId, mode);
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

export const projectInsightsService = new ProjectInsightsService();