import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  PrismaService,
} from "@traveltok/database";
import {
  createVideoClassifier,
  VIDEO_CLASSIFIER_PROMPT_VERSION,
  VideoClassificationInput,
} from "@traveltok/ai";
import { buildPagination, paginationParams } from "../common/utils/pagination";
import { AI_CONFIG } from "./ai.constants";
import { AiRuntimeService } from "./ai-runtime.service";
import type { AIConfig } from "@traveltok/ai";

@Injectable()
export class AiAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_CONFIG) private readonly config: AIConfig,
    private readonly runtime: AiRuntimeService,
  ) {}

  /**
   * Classifies a video's metadata into a `ContentAnalysis` row. The AI output
   * is validated (zod) before anything is written; on failure no row is
   * created and the error propagates as a 500.
   */
  async analyzeVideo(userId: string, videoId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      include: {
        creator: { select: { username: true } },
        hashtags: { include: { hashtag: { select: { name: true } } } },
        metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
      },
    });
    if (!video) {
      throw new NotFoundException("Video not found");
    }

    const mode = await this.runtime.modeFor(userId);
    const model = await this.runtime.modelFor(userId, mode);
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

    return this.prisma.contentAnalysis.create({
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
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true },
    });
    if (!video) {
      throw new NotFoundException("Video not found");
    }

    const where = { videoId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contentAnalysis.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.contentAnalysis.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }
}
