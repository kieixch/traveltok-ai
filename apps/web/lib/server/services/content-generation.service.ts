import { Prisma } from "@traveltok/database";
import {
  createCaptionGenerator,
  createContentIdeaGenerator,
  createInsightsGenerator,
  createScriptGenerator,
  type AIConfig,
  type CaptionGeneratorInput,
  type ContentFormat,
  type ContentIdeaDraft,
  type ContentIdeaGeneratorInput,
  type CtaType,
  type ScriptGeneratorInput,
} from "@traveltok/ai";
import { getPrisma } from "@/lib/server/prisma";
import { notFound } from "@/lib/server/http";
import { getAIConfig } from "@/lib/server/ai";
import { analyticsService } from "./analytics.service";
import { aiRuntimeService } from "./ai-runtime.service";

const DEFAULT_FORMAT_MIX: ContentFormat[] = [
  "VLOG",
  "LISTICLE",
  "TUTORIAL",
  "POV",
];

export interface GenerateContentIdeasInput {
  projectId: string;
  count?: number;
  format?: ContentFormat;
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

  private persistDrafts(projectId: string, drafts: ContentIdeaDraft[], model: string) {
    return getPrisma().$transaction(
      drafts.map((draft) =>
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

export const contentGenerationService = new ContentGenerationService();