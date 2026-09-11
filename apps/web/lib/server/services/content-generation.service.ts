import { Prisma } from "@traveltok/database";
import {
  createCaptionGenerator,
  createContentIdeaGenerator,
  createInsightsGenerator,
  createScriptGenerator,
  createVideoClassifier,
  VIDEO_CLASSIFIER_PROMPT_VERSION,
  type AIConfig,
  type CaptionGeneratorInput,
  type ContentFormat,
  type ContentIdeaDraft,
  type ContentIdeaGeneratorInput,
  type ContentVideoReference,
  type CtaType,
  type ScriptGeneratorInput,
  type VideoClassificationInput,
} from "@traveltok/ai";
import { getPrisma } from "@/lib/server/prisma";
import { badRequest, notFound } from "@/lib/server/http";
import { getAIConfig } from "@/lib/server/ai";
import { analyticsService } from "./analytics.service";
import { aiRuntimeService } from "./ai-runtime.service";

const DEFAULT_FORMAT_MIX: ContentFormat[] = [
  "VLOG",
  "LISTICLE",
  "TUTORIAL",
  "POV",
];

const analysisVideoInclude = {
  creator: { select: { username: true } },
  hashtags: { include: { hashtag: { select: { name: true } } } },
  metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
  analyses: { orderBy: { createdAt: "desc" }, take: 1 },
} as const satisfies Prisma.VideoInclude;

type VideoForAnalysis = Prisma.VideoGetPayload<{
  include: typeof analysisVideoInclude;
}>;

const sourceVideoInclude = {
  sourceVideo: {
    select: {
      id: true,
      url: true,
      caption: true,
      thumbnailUrl: true,
      creator: { select: { username: true } },
      metrics: {
        orderBy: { collectedAt: "desc" },
        take: 1,
        select: { views: true, likes: true },
      },
    },
  },
} as const;

export interface GenerateContentIdeasInput {
  projectId: string;
  count?: number;
  format?: ContentFormat;
  language?: string;
}

export interface GenerateIdeasFromVideosInput {
  projectId: string;
  videoIds?: string[];
  count?: number;
  language?: string;
}

export interface GenerateScriptInput {
  language?: string;
}

export interface GenerateCaptionInput {
  language?: string;
}

class ContentGenerationService {
  private readonly config: AIConfig;

  constructor() {
    this.config = getAIConfig();
  }

  async generateIdeas(userId: string, dto: GenerateContentIdeasInput) {
    const project = await getPrisma().project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, name: true, niche: true },
    });
    if (!project) {
      throw notFound("Project not found");
    }

    const mode = await aiRuntimeService.modeFor(userId);
    const model = await aiRuntimeService.modelFor(userId, mode);

    const overview = await analyticsService.overview(project.id);
    const hashtags = await analyticsService.hashtagPerformance(project.id, 5);
    const [destinations, formatMix] = await Promise.all([
      this.topDestinations(project.id),
      this.resolveFormatMix(project.id, overview, dto.format, mode, model),
    ]);

    const input: ContentIdeaGeneratorInput = {
      projectName: project.name,
      niche: project.niche,
      topHashtags: hashtags.map((h) => h.name),
      topDestinations: destinations,
      formatMix,
      count: dto.count ?? 5,
      randomness: project.id,
      language: dto.language,
    };

    const ideaGenerator = createContentIdeaGenerator(this.config, mode, model);
    const drafts = await ideaGenerator.generate(input);
    const label = mode === "mock" ? "mock-idea-generator" : model;
    const ideas = await this.persistDrafts(project.id, drafts, label);
    return { ideas, model: label, generatedBy: "AI" };
  }

  /**
   * "Get Ideas" — analyzes scraped videos (reusing existing analyses when
   * present, running the AI classifier on the rest) and generates one idea per
   * analyzed video, persisted as a content idea that references its source
   * video.
   */
  async generateIdeasFromVideos(userId: string, dto: GenerateIdeasFromVideosInput) {
    const prisma = getPrisma();
    const project = await prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, name: true, niche: true },
    });
    if (!project) {
      throw notFound("Project not found");
    }

    const videos = await prisma.video.findMany({
      where: {
        projectId: dto.projectId,
        isSeedData: false,
        ...(dto.videoIds && dto.videoIds.length > 0 ? { id: { in: dto.videoIds } } : {}),
      },
      take: 50,
      orderBy: [{ scrapedAt: "desc" }, { publishedAt: "desc" }],
      include: analysisVideoInclude,
    });
    if (videos.length === 0) {
      throw badRequest("No scraped videos found for this project. Scrape some data first.");
    }

    const mode = await aiRuntimeService.modeFor(userId);
    const model = await aiRuntimeService.modelFor(userId, mode);
    const target = Math.min(Math.max(1, dto.count ?? 5), videos.length, 10);

    const already = videos.filter((video) => video.analyses[0] !== undefined);
    const pending = videos.filter((video) => video.analyses[0] === undefined);
    const classifier = createVideoClassifier(this.config, mode, model);

    // Reuse existing analyses first, then top up with on-the-fly classification.
    const byAnalysis = (video: VideoForAnalysis, analysis: NonNullable<VideoForAnalysis["analyses"]>[number]) =>
      this.buildReference(video, analysis, mode, model);

    const references: ContentVideoReference[] = [];
    let remaining = target;

    for (const video of already) {
      if (remaining <= 0) break;
      const analysis = video.analyses[0];
      references.push(byAnalysis(video, analysis));
      remaining -= 1;
    }

    for (const video of pending) {
      if (remaining <= 0) break;
      const classification = await classifier.classify(this.buildClassificationInput(video));
      const analysis = await prisma.contentAnalysis.create({
        data: {
          videoId: video.id,
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
      references.push(this.buildReference(video, analysis, mode, model, classification.summary));
      remaining -= 1;
    }

    if (references.length === 0) {
      throw badRequest("Could not analyze any videos for this project.");
    }

    const hashtagCount = new Map<string, number>();
    for (const ref of references) {
      for (const tag of ref.hashtags) hashtagCount.set(tag, (hashtagCount.get(tag) ?? 0) + 1);
    }
    const topHashtags = [...hashtagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
    const topDestinations = [...new Set(references.map((r) => r.destination))].filter(
      (x): x is string => x !== null,
    ).slice(0, 8);
    const formatMix = [...new Set(
      references
        .map((r) => r.contentFormat)
        .filter((f): f is ContentFormat => f !== null),
    )];
    const input: ContentIdeaGeneratorInput = {
      projectName: project.name,
      niche: project.niche,
      topHashtags,
      topDestinations,
      formatMix: formatMix.length > 0 ? formatMix : DEFAULT_FORMAT_MIX,
      count: references.length,
      randomness: `${project.id}:${references.map((r) => r.videoId).join(",")}`,
      language: dto.language,
      references,
    };

    const ideaGenerator = createContentIdeaGenerator(this.config, mode, model);
    const drafts = await ideaGenerator.generate(input);
    const label = mode === "mock" ? "mock-idea-generator" : model;
    const ideas = await this.persistDrafts(
      project.id,
      drafts,
      label,
      (index) => references[index % references.length].videoId,
    );
    return { ideas, model: label, generatedBy: "AI" };
  }

  private buildClassificationInput(video: VideoForAnalysis): VideoClassificationInput {
    const metrics = video.metrics[0];
    return {
      caption: video.caption,
      description: video.description,
      location: video.location,
      hashtags: video.hashtags.map((vh) => vh.hashtag.name),
      creatorUsername: video.creator.username,
      duration: video.duration,
      views: metrics ? Number(metrics.views) : undefined,
      likes: metrics ? Number(metrics.likes) : undefined,
      comments: metrics ? Number(metrics.comments) : undefined,
      engagementRate: metrics?.engagementRate ?? undefined,
    };
  }

  private buildReference(
    video: VideoForAnalysis,
    analysis: NonNullable<VideoForAnalysis["analyses"]>[number],
    mode: string,
    model: string,
    summaryOverride?: string | null,
  ): ContentVideoReference {
    const raw = analysis.rawJson as unknown as { summary?: string | null } | null;
    return {
      videoId: video.id,
      caption: analysis.hookText ?? video.caption,
      creatorUsername: video.creator.username,
      destination: analysis.destination,
      topic: analysis.topic,
      contentFormat: analysis.contentFormat,
      hookType: analysis.hookType,
      hookText: analysis.hookText,
      summary: summaryOverride ?? raw?.summary ?? null,
      views: video.metrics[0] ? Number(video.metrics[0].views) : null,
      likes: video.metrics[0] ? Number(video.metrics[0].likes) : null,
      hashtags: video.hashtags.map((vh) => vh.hashtag.name).slice(0, 8),
    };
  }

  async generateScript(userId: string, ideaId: string, dto?: GenerateScriptInput) {
    const idea = await getPrisma().contentIdea.findUnique({
      where: { id: ideaId },
    });
    if (!idea) {
      throw notFound("Content idea not found");
    }

    const mode = await aiRuntimeService.modeFor(userId);
    const model = await aiRuntimeService.modelFor(userId, mode);
    const scriptGenerator = createScriptGenerator(this.config, mode, model);

    const input: ScriptGeneratorInput = {
      ideaTitle: idea.title,
      hook: idea.hook,
      format: idea.format ?? "OTHER",
      topic: idea.topic,
      destination: idea.destination,
      targetAudience: idea.targetAudience,
      cta: idea.cta as CtaType | null,
      randomness: idea.id,
      language: dto?.language,
    };

    const script = await scriptGenerator.generate(input);
    const label = mode === "mock" ? "mock-script-generator" : model;

    return getPrisma().contentIdea.update({
      where: { id: idea.id },
      data: {
        script: renderScriptText(script),
        scriptOutline: script.outline as unknown as Prisma.InputJsonValue,
        aiModel: label,
        rawJson: script as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async generateCaption(userId: string, ideaId: string, dto?: GenerateCaptionInput) {
    const idea = await getPrisma().contentIdea.findUnique({
      where: { id: ideaId },
    });
    if (!idea) {
      throw notFound("Content idea not found");
    }

    const mode = await aiRuntimeService.modeFor(userId);
    const model = await aiRuntimeService.modelFor(userId, mode);
    const captionGenerator = createCaptionGenerator(this.config, mode, model);

    const input: CaptionGeneratorInput = {
      ideaTitle: idea.title,
      topic: idea.topic,
      destination: idea.destination,
      format: idea.format ?? "OTHER",
      hook: idea.hook,
      cta: idea.cta as CtaType | null,
      hashtags: idea.hashtags ?? [],
      randomness: idea.id,
      language: dto?.language,
    };

    const caption = await captionGenerator.generate(input);
    const label = mode === "mock" ? "mock-caption-generator" : model;

    return getPrisma().contentIdea.update({
      where: { id: idea.id },
      data: {
        caption: caption.caption,
        hashtags: caption.hashtags,
        cta: caption.cta,
        aiModel: label,
        rawJson: caption as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async resolveFormatMix(
    projectId: string,
    overview: ReturnType<typeof analyticsService.overview> extends Promise<infer U> ? U : never,
    explicitFormat?: ContentFormat,
    mode?: Parameters<typeof createInsightsGenerator>[1],
    model?: Parameters<typeof createInsightsGenerator>[2],
  ): Promise<ContentFormat[]> {
    if (explicitFormat) return [explicitFormat];

    const insightsGenerator = createInsightsGenerator(this.config, mode, model);

    const insight = await insightsGenerator.generate({
      projectName: "project",
      videoCount: overview.videoCount,
      creatorCount: overview.creatorCount,
      totalViews: overview.totalViews,
      avgEngagementRate: overview.avgEngagementRate,
      topCreator: overview.topCreator?.username ?? null,
      topHashtags: [],
      periodDays: 30,
    });

    return [...new Set([insight.predictedBestFormat, ...DEFAULT_FORMAT_MIX])];
  }

  private async topDestinations(projectId: string, limit = 5): Promise<string[]> {
    const rows = await getPrisma().$queryRaw<Array<{ destination: string }>>`
      SELECT ca."destination" AS "destination"
      FROM "ContentAnalysis" ca
      JOIN "Video" v ON v."id" = ca."videoId"
      WHERE v."projectId" = ${projectId} AND ca."destination" IS NOT NULL
      GROUP BY ca."destination"
      ORDER BY COUNT(*) DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => row.destination);
  }

  private persistDrafts(
    projectId: string,
    drafts: ContentIdeaDraft[],
    model: string,
    sourceFor: (index: number) => string | null = () => null,
  ) {
    return getPrisma().$transaction(
      drafts.map((draft, index) =>
        getPrisma().contentIdea.create({
          data: {
            projectId,
            title: draft.title,
            topic: draft.topic,
            destination: draft.destination,
            format: draft.format,
            hook: draft.hook,
            concept: draft.concept,
            targetAudience: draft.targetAudience,
            cta: draft.cta,
            estimatedDuration: draft.estimatedDuration,
            opportunityScore: draft.opportunityScore,
            aiReasoning: draft.aiReasoning,
            hashtags: draft.hashtags,
            generatedBy: "AI",
            aiModel: model,
            sourceVideoId: sourceFor(index),
            rawJson: draft as unknown as Prisma.InputJsonValue,
          },
          include: sourceVideoInclude,
        }),
      ),
    );
  }
}

export interface GeneratedScript {
  hook: string;
  outline: Array<{ section: string; durationSeconds: number; description: string }>;
  cta: string;
  tone: string;
}

function renderScriptText(script: GeneratedScript): string {
  const lines = [`HOOK: ${script.hook}`, ""];
  script.outline.forEach((scene, index) => {
    lines.push(
      `${index + 1}. [${scene.durationSeconds}s] ${scene.section} — ${scene.description}`,
    );
  });
  lines.push("", `CTA: ${script.cta}`, `Tone: ${script.tone}`);
  return lines.join("\n");
}

export const contentGenerationService = new ContentGenerationService();