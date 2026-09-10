import { randomUUID } from "node:crypto";
import {
  createEmbeddingGenerator,
  vectorToLiteral,
  type AIConfig,
  type EmbeddingGenerator,
} from "@traveltok/ai";
import { getPrisma } from "@/lib/server/prisma";
import { notFound } from "@/lib/server/http";
import { getAIConfig } from "@/lib/server/ai";

export type EmbeddingEntityType = "VIDEO" | "IDEA" | "TREND";

export const EMBEDDING_ENTITY_TYPES: EmbeddingEntityType[] = [
  "VIDEO",
  "IDEA",
  "TREND",
];

export interface IndexResult {
  videos: number;
  ideas: number;
  trends: number;
  model: string;
}

export interface IndexMeta {
  indexed: boolean;
  videos: number;
  ideas: number;
  trends: number;
  total: number;
  model: string | null;
}

/**
 * Generates embeddings (mock or OpenAI/Gemini) and persists them into the
 * pgvector `Embedding` table via raw SQL — Prisma cannot write `Unsupported`
 * columns, so `vector` is managed exclusively through `$executeRaw`.
 */
class EmbeddingsService {
  private readonly generator: EmbeddingGenerator;

  private readonly config: AIConfig;

  constructor() {
    this.config = getAIConfig();
    // Embeddings follow the server default (AI_MODE).
    this.generator = createEmbeddingGenerator(this.config, this.config.mode);
  }

  /**
   * (Re)indexes every video, content idea and trend of an owned project.
   * Idempotent — existing rows are upserted, so it can be called repeatedly.
   */
  async indexProject(userId: string, projectId: string): Promise<IndexResult> {
    await this.requireOwnedProject(userId, projectId);
    const prisma = getPrisma();

    const [videos, ideas, trends] = await Promise.all([
      prisma.video.findMany({
        where: { projectId },
        include: {
          creator: { select: { username: true } },
          hashtags: { include: { hashtag: { select: { name: true } } } },
        },
      }),
      prisma.contentIdea.findMany({ where: { projectId } }),
      prisma.trend.findMany({ where: { projectId } }),
    ]);

    let model = "";
    for (const video of videos) {
      const embedded = await this.upsert(
        projectId,
        "VIDEO",
        video.id,
        this.videoContent(video),
      );
      model = embedded.model;
    }
    for (const idea of ideas) {
      const embedded = await this.upsert(
        projectId,
        "IDEA",
        idea.id,
        this.ideaContent(idea),
      );
      model = embedded.model;
    }
    for (const trend of trends) {
      const embedded = await this.upsert(
        projectId,
        "TREND",
        trend.id,
        this.trendContent(trend),
      );
      model = embedded.model;
    }

    return {
      videos: videos.length,
      ideas: ideas.length,
      trends: trends.length,
      model,
    };
  }

  /** Counts indexed entities per type for an owned project. */
  async meta(userId: string, projectId: string): Promise<IndexMeta> {
    await this.requireOwnedProject(userId, projectId);

    const rows = await getPrisma().$queryRaw<
      Array<{ entityType: string; count: number; model: string | null }>
    >`
      SELECT e."entityType", COUNT(*)::int AS "count", MAX(e."model") AS "model"
      FROM "Embedding" e
      WHERE e."projectId" = ${projectId}
      GROUP BY e."entityType"
    `;

    const byType = new Map(rows.map((r) => [r.entityType, r]));
    const videos = byType.get("VIDEO")?.count ?? 0;
    const ideas = byType.get("IDEA")?.count ?? 0;
    const trends = byType.get("TREND")?.count ?? 0;
    return {
      indexed: videos + ideas + trends > 0,
      videos,
      ideas,
      trends,
      total: videos + ideas + trends,
      model: rows[0]?.model ?? null,
    };
  }

  private async requireOwnedProject(userId: string, projectId: string) {
    const project = await getPrisma().project.findFirst({
      where: { id: projectId, createdById: userId },
      select: { id: true },
    });
    if (!project) {
      throw notFound("Project not found");
    }
  }

  private async upsert(
    projectId: string,
    entityType: EmbeddingEntityType,
    entityId: string,
    content: string,
  ) {
    const { vector, model, dimension } = await this.generator.embed(content);
    await getPrisma().$executeRaw`
      INSERT INTO "Embedding"
        (id, "projectId", "entityType", "entityId", content, model, dimension,
         vector, "isSeedData", "createdAt", "updatedAt")
      VALUES
        (${randomUUID()}, ${projectId}, ${entityType}, ${entityId}, ${content},
         ${model}, ${dimension}, ${vectorToLiteral(vector)}::vector, false,
         now(), now())
      ON CONFLICT ("entityType", "entityId") DO UPDATE SET
        content = EXCLUDED.content,
        model = EXCLUDED.model,
        dimension = EXCLUDED.dimension,
        vector = EXCLUDED.vector,
        "updatedAt" = now()
    `;
    return { model };
  }

  private videoContent(video: {
    caption: string | null;
    description: string | null;
    location: string | null;
    musicName: string | null;
    creator: { username: string | null } | null;
    hashtags: Array<{ hashtag: { name: string } }>;
  }): string {
    return [
      video.caption,
      video.description,
      video.location,
      video.musicName,
      video.creator?.username,
      ...video.hashtags.map((h) => h.hashtag.name),
    ]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" | ");
  }

  private ideaContent(idea: {
    title: string;
    topic: string | null;
    destination: string | null;
    concept: string | null;
    hook: string | null;
    targetAudience: string | null;
    hashtags: string[];
  }): string {
    return [idea.title, idea.topic, idea.destination, idea.concept, idea.hook, idea.targetAudience, ...idea.hashtags]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" | ");
  }

  private trendContent(trend: { keyword: string; type: string }): string {
    return `${trend.keyword} | ${trend.type}`;
  }
}

export const embeddingsService = new EmbeddingsService();