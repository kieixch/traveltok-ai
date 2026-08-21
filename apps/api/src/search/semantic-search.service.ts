import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaService } from "@traveltok/database";
import {
  AIConfig,
  createEmbeddingGenerator,
  EmbeddingGenerator,
  vectorToLiteral,
} from "@traveltok/ai";
import { AI_CONFIG } from "../ai/ai.constants";
import { EmbeddingsService, EmbeddingEntityType } from "./embeddings.service";

export interface SearchHit {
  entityType: EmbeddingEntityType;
  entityId: string;
  score: number;
  content: string;
  model: string;
  entity: Record<string, unknown> | null;
}

export interface SearchOptions {
  userId: string;
  projectId: string;
  query: string;
  entityTypes: EmbeddingEntityType[];
  limit: number;
}

/**
 * Vector similarity search over indexed entities using pgvector cosine
 * distance. Query and stored vectors share the same generator, so the
 * embedding space is consistent within one environment.
 */
@Injectable()
export class SemanticSearchService {
  private readonly generator: EmbeddingGenerator;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingsService: EmbeddingsService,
    @Inject(AI_CONFIG) private readonly config: AIConfig,
  ) {
    this.generator = createEmbeddingGenerator(config);
  }

  /** Returns indexed-entity counts for an owned project. */
  meta(userId: string, projectId: string) {
    return this.embeddingsService.meta(userId, projectId);
  }

  async search(options: SearchOptions): Promise<SearchHit[]> {
    const { userId, projectId, query, entityTypes, limit } = options;
    await this.requireOwnedProject(userId, projectId);

    const { vector } = await this.generator.embed(query);

    const rows = await this.prisma.$queryRaw<
      Array<{
        entityType: EmbeddingEntityType;
        entityId: string;
        content: string;
        model: string;
        score: number;
      }>
    >`
      SELECT
        e."entityType", e."entityId", e.content, e.model,
        ROUND((1 - (e.vector <=> ${vectorToLiteral(vector)}::vector))::numeric, 4)::float AS "score"
      FROM "Embedding" e
      WHERE e."projectId" = ${projectId}
        AND e."entityType" IN (${Prisma.join(entityTypes)})
      ORDER BY e.vector <=> ${vectorToLiteral(vector)}::vector
      LIMIT ${limit}
    `;

    if (rows.length === 0) return [];

    const videos = await this.loadVideos(rows);
    const ideas = await this.loadIdeas(rows);
    const trends = await this.loadTrends(rows);

    return rows.map((row) => {
      let entity: Record<string, unknown> | undefined;
      if (row.entityType === "VIDEO") {
        const v = videos.get(row.entityId);
        if (v) {
          entity = {
            id: v.id,
            caption: v.caption,
            description: v.description,
            location: v.location,
            thumbnailUrl: v.thumbnailUrl,
            url: v.url,
            publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
            duration: v.duration,
            creatorUsername: v.creator?.username ?? null,
            views: v.metrics[0] ? Number(v.metrics[0].views) : null,
            likes: v.metrics[0] ? Number(v.metrics[0].likes) : null,
          };
        }
      } else if (row.entityType === "IDEA") {
        const idea = ideas.get(row.entityId);
        if (idea) {
          entity = {
            id: idea.id,
            title: idea.title,
            topic: idea.topic,
            destination: idea.destination,
            format: idea.format,
            status: idea.status,
            opportunityScore: idea.opportunityScore,
            hashtags: idea.hashtags,
          };
        }
      } else {
        const trend = trends.get(row.entityId);
        if (trend) {
          entity = {
            id: trend.id,
            keyword: trend.keyword,
            type: trend.type,
            trendScore: trend.trendScore,
            opportunityScore: trend.opportunityScore,
          };
        }
      }

      return {
        entityType: row.entityType,
        entityId: row.entityId,
        score: row.score,
        content: row.content,
        model: row.model,
        entity: entity ?? null,
      };
    });
  }

  private async requireOwnedProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, createdById: userId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
  }

  private async loadVideos(rows: Array<{ entityType: string; entityId: string }>) {
    const ids = rows.filter((r) => r.entityType === "VIDEO").map((r) => r.entityId);
    if (ids.length === 0) return new Map();
    const videos = await this.prisma.video.findMany({
      where: { id: { in: ids } },
      include: {
        creator: { select: { username: true } },
        metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
      },
    });
    return new Map(videos.map((v) => [v.id, v]));
  }

  private async loadIdeas(rows: Array<{ entityType: string; entityId: string }>) {
    const ids = rows.filter((r) => r.entityType === "IDEA").map((r) => r.entityId);
    if (ids.length === 0) return new Map();
    const ideas = await this.prisma.contentIdea.findMany({
      where: { id: { in: ids } },
    });
    return new Map(ideas.map((i) => [i.id, i]));
  }

  private async loadTrends(rows: Array<{ entityType: string; entityId: string }>) {
    const ids = rows.filter((r) => r.entityType === "TREND").map((r) => r.entityId);
    if (ids.length === 0) return new Map();
    const trends = await this.prisma.trend.findMany({
      where: { id: { in: ids } },
    });
    return new Map(trends.map((t) => [t.id, t]));
  }
}
