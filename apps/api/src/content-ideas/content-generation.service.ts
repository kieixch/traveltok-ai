import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaService } from "@traveltok/database";
import {
  AIConfig,
  ContentFormat,
  ContentIdeaDraft,
  ContentIdeaGeneratorInput,
  CaptionGeneratorInput,
  createCaptionGenerator,
  createContentIdeaGenerator,
  createInsightsGenerator,
  createScriptGenerator,
  CtaType,
  ScriptGeneratorInput,
} from "@traveltok/ai";
import { AnalyticsService } from "../analytics/analytics.service";
import { AI_CONFIG } from "../ai/ai.constants";
import { AiRuntimeService } from "../ai/ai-runtime.service";
import { GenerateContentIdeasDto } from "./dto/generate-content-ideas.dto";
import { GenerateScriptDto } from "./dto/generate-script.dto";
import { GenerateCaptionDto } from "./dto/generate-caption.dto";

const DEFAULT_FORMAT_MIX: ContentFormat[] = [
  "VLOG",
  "LISTICLE",
  "TUTORIAL",
  "POV",
];

@Injectable()
export class ContentGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    @Inject(AI_CONFIG) private readonly config: AIConfig,
    private readonly runtime: AiRuntimeService,
  ) {}

  async generateIdeas(userId: string, dto: GenerateContentIdeasDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, name: true, niche: true },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const mode = await this.runtime.modeFor(userId);
    const model = await this.runtime.modelFor(userId, mode);

    const overview = await this.analytics.overview(project.id);
    const hashtags = await this.analytics.hashtagPerformance(project.id, 5);
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

  async generateScript(userId: string, ideaId: string, dto?: GenerateScriptDto) {
    const idea = await this.prisma.contentIdea.findUnique({
      where: { id: ideaId },
    });
    if (!idea) {
      throw new NotFoundException("Content idea not found");
    }

    const mode = await this.runtime.modeFor(userId);
    const model = await this.runtime.modelFor(userId, mode);
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

    return this.prisma.contentIdea.update({
      where: { id: idea.id },
      data: {
        script: renderScriptText(script),
        scriptOutline: script.outline as unknown as Prisma.InputJsonValue,
        aiModel: label,
        rawJson: script as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async generateCaption(userId: string, ideaId: string, dto?: GenerateCaptionDto) {
    const idea = await this.prisma.contentIdea.findUnique({
      where: { id: ideaId },
    });
    if (!idea) {
      throw new NotFoundException("Content idea not found");
    }

    const mode = await this.runtime.modeFor(userId);
    const model = await this.runtime.modelFor(userId, mode);
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

    return this.prisma.contentIdea.update({
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
    overview: Awaited<ReturnType<AnalyticsService["overview"]>>,
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
    const rows = await this.prisma.$queryRaw<Array<{ destination: string }>>`
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

  private persistDrafts(projectId: string, drafts: ContentIdeaDraft[], model: string) {
    return this.prisma.$transaction(
      drafts.map((draft) =>
        this.prisma.contentIdea.create({
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
            rawJson: draft as unknown as Prisma.InputJsonValue,
          },
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
