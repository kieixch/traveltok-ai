import { getPrisma } from "@/lib/server/prisma";
import { notFound } from "@/lib/server/http";
import {
  createInsightsGenerator,
  type AIConfig,
  type ProjectInsight,
} from "@traveltok/ai";
import { getAIConfig } from "@/lib/server/ai";
import { analyticsService } from "./analytics.service";
import { aiRuntimeService } from "./ai-runtime.service";
import { requireOwnedProject } from "@/lib/server/authz";

export interface CountedLabel {
  label: string;
  count: number;
}

export interface StrongestWeakest {
  id: string;
  caption: string | null;
  aiScore: number | null;
}

export interface AnalysisBreakdown {
  formats: CountedLabel[];
  topTopics: CountedLabel[];
  topDestinations: CountedLabel[];
  hookTypes: CountedLabel[];
  sentimentBreakdown: CountedLabel[];
  strongestVideo: StrongestWeakest | null;
  weakestVideo: StrongestWeakest | null;
}

export interface ProjectInsightsBundle extends ProjectInsight, AnalysisBreakdown {
  projectId: string;
}

class ProjectInsightsService {
  private readonly config: AIConfig;

  constructor() {
    this.config = getAIConfig();
  }

  /** Aggregates project analytics and asks the AI engine for a strategy review. */
  async insights(userId: string, projectId: string): Promise<ProjectInsightsBundle> {
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

    const ai = await generator.generate({
      projectName: project.name,
      videoCount: overview.videoCount,
      creatorCount: overview.creatorCount,
      totalViews: overview.totalViews,
      avgEngagementRate: overview.avgEngagementRate,
      topCreator: overview.topCreator?.username ?? null,
      topHashtags: hashtags.map((h) => h.name),
      periodDays: 30,
    });
    const breakdown = await this.analysisBreakdown(projectId);

    return {
      ...ai,
      projectId: project.id,
      ...breakdown,
    };
  }

  /** Groups analyzed-video fields (destination, topic, format, hook, sentiment). */
  private async analysisBreakdown(projectId: string): Promise<AnalysisBreakdown> {
    const prisma = getPrisma();
    const [formats, topics, destinations, hookTypes, sentiments, strongest, weakest] =
      await Promise.all([
        prisma.$queryRaw<CountedLabel[]>`
          SELECT ca."contentFormat" AS "label", COUNT(*)::int AS "count"
          FROM "ContentAnalysis" ca
          JOIN "Video" v ON v."id" = ca."videoId"
          WHERE v."projectId" = ${projectId} AND ca."contentFormat" IS NOT NULL
          GROUP BY ca."contentFormat"
          ORDER BY "count" DESC, ca."contentFormat" ASC
          LIMIT 6`,
        prisma.$queryRaw<CountedLabel[]>`
          SELECT ca."topic" AS "label", COUNT(*)::int AS "count"
          FROM "ContentAnalysis" ca
          JOIN "Video" v ON v."id" = ca."videoId"
          WHERE v."projectId" = ${projectId} AND ca."topic" IS NOT NULL
          GROUP BY ca."topic"
          ORDER BY "count" DESC, ca."topic" ASC
          LIMIT 6`,
        prisma.$queryRaw<CountedLabel[]>`
          SELECT ca."destination" AS "label", COUNT(*)::int AS "count"
          FROM "ContentAnalysis" ca
          JOIN "Video" v ON v."id" = ca."videoId"
          WHERE v."projectId" = ${projectId} AND ca."destination" IS NOT NULL
          GROUP BY ca."destination"
          ORDER BY "count" DESC, ca."destination" ASC
          LIMIT 6`,
        prisma.$queryRaw<CountedLabel[]>`
          SELECT ca."hookType" AS "label", COUNT(*)::int AS "count"
          FROM "ContentAnalysis" ca
          JOIN "Video" v ON v."id" = ca."videoId"
          WHERE v."projectId" = ${projectId} AND ca."hookType" IS NOT NULL
          GROUP BY ca."hookType"
          ORDER BY "count" DESC, ca."hookType" ASC
          LIMIT 6`,
        prisma.$queryRaw<CountedLabel[]>`
          SELECT ca."sentiment" AS "label", COUNT(*)::int AS "count"
          FROM "ContentAnalysis" ca
          JOIN "Video" v ON v."id" = ca."videoId"
          WHERE v."projectId" = ${projectId} AND ca."sentiment" IS NOT NULL
          GROUP BY ca."sentiment"
          ORDER BY "count" DESC, ca."sentiment" ASC
          LIMIT 6`,
        prisma.$queryRaw<StrongestWeakest[]>`
          SELECT v."id", v."caption", ca."aiScore"
          FROM "ContentAnalysis" ca
          JOIN "Video" v ON v."id" = ca."videoId"
          WHERE v."projectId" = ${projectId} AND ca."aiScore" IS NOT NULL
          ORDER BY ca."aiScore" DESC, v."id" ASC
          LIMIT 1`,
        prisma.$queryRaw<StrongestWeakest[]>`
          SELECT v."id", v."caption", ca."aiScore"
          FROM "ContentAnalysis" ca
          JOIN "Video" v ON v."id" = ca."videoId"
          WHERE v."projectId" = ${projectId} AND ca."aiScore" IS NOT NULL
          ORDER BY ca."aiScore" ASC, v."id" ASC
          LIMIT 1`,
      ]);

    return {
      formats,
      topTopics: topics,
      topDestinations: destinations,
      hookTypes,
      sentimentBreakdown: sentiments,
      strongestVideo: strongest[0] ?? null,
      weakestVideo: weakest[0] ?? null,
    };
  }
}

export const projectInsightsService = new ProjectInsightsService();