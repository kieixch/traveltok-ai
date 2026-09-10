import { Prisma } from "@traveltok/database";
import {
  createVideoClassifier,
  VIDEO_CLASSIFIER_PROMPT_VERSION,
  type VideoClassificationInput,
  type AIConfig,
} from "@traveltok/ai";
import { getPrisma } from "@/lib/server/prisma";
import { buildPagination, paginationParams } from "@/lib/server/utils";
import { notFound } from "@/lib/server/http";
import { getAIConfig } from "@/lib/server/ai";
import { aiRuntimeService } from "./ai-runtime.service";

class AiAnalysisService {
  private readonly config: AIConfig;

  constructor() {
    this.config = getAIConfig();
  }

  /**
   * Classifies a video's metadata into a `ContentAnalysis` row. The AI output
   * is validated (zod) before anything is written; on failure no row is
   * created and the error propagates as a 500.
   */
  async analyzeVideo(userId: string, videoId: string) {
    const prisma = getPrisma();
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        creator: { select: { username: true } },
        hashtags: { include: { hashtag: { select: { name: true } } } },
        metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
      },
    });
    if (!video) {
      throw notFound("Video not found");
    }

    const mode = await aiRuntimeService.modeFor(userId);
    const model = await aiRuntimeService.modelFor(userId, mode);
    const classifier = createVideoClassifier(this.config, mode, model);
    const latest = video.metrics[0];
    const input: VideoClassificationInput = {
      caption: video.caption,
      description: video.description,
      location: video.location,
      hashtags: video.hashtags.map((vh) => vh.hashtag.name),
      creatorUsername: video.creator.username,
      duration: video.duration,
      views: latest ? Number(latest.views) : undefined,
      likes: latest ? Number(latest.likes) : undefined,
      comments: latest ? Number(latest.comments) : undefined,
      engagementRate: latest?.engagementRate ?? undefined,
    };

    const classification = await classifier.classify(input);

    return prisma.contentAnalysis.create({
      data: {
        videoId,
        topic: classification.topic,
        subTopic: classification.subTopic,
        destination: classification.destination,
        contentFormat: classification.contentFormat,
        hookType: classification.hookType,
        hookText: classification.hookText,
        ctaType: classification.ctaType,
        sentiment: classification.sentiment,
        targetAudience: classification.targetAudience,
        estimatedIntent: classification.estimatedIntent,
        aiScore: classification.aiScore,
        analysisVersion: VIDEO_CLASSIFIER_PROMPT_VERSION,
        model: mode === "mock" ? "mock-classifier" : model,
        rawJson: classification as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async listAnalyses(videoId: string, page: number, pageSize: number) {
    const prisma = getPrisma();
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true },
    });
    if (!video) {
      throw notFound("Video not found");
    }

    const where = { videoId };
    const [items, total] = await prisma.$transaction([
      prisma.contentAnalysis.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { createdAt: "desc" },
      }),
      prisma.contentAnalysis.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }
}

export const aiAnalysisService = new AiAnalysisService();