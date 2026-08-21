import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@traveltok/database";
import { normalizeHashtag } from "../common/utils/hashtags";

export interface TrendWeights {
  growth: number;
  engagement: number;
  frequency: number;
  recency: number;
  contentGap: number;
}

export interface TrendScoreInputs {
  matchingVideos: number;
  totalVideos: number;
  matchingCreators: number;
  totalCreators: number;
  avgEngagementRate: number | null;
  recentCount: number;
  earlierCount: number;
}

export interface TrendScoreResult {
  matchingVideos: number;
  totalVideos: number;
  matchingCreators: number;
  totalCreators: number;
  growthRate: number;
  engagementScore: number;
  frequencyScore: number;
  recencyScore: number;
  contentGapScore: number;
  trendScore: number;
  opportunityScore: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Pure scoring engine. Each component is 0–100:
 *  - growthRate      % change of matching videos between the earlier window and
 *                    the recent window (may be negative).
 *  - growthScore     growthRate capped at ±200% (0–100).
 *  - engagementScore avg engagement rate mapped linearly (5% -> 100).
 *  - frequencyScore  share of project videos that match (50% -> 100).
 *  - recencyScore    share of matching videos published inside the recent window.
 *  - contentGapScore share of the niche NOT yet covered by project creators
 *                    (100 = nobody in this project posts about it yet).
 *  - trendScore      weighted sum of the 0–100 components.
 *  - opportunityScore trendScore blended with content gap.
 *
 * When nothing matches we deliberately return 0 for trend/opportunity: no
 * scraped evidence means no trend signal.
 */
export function computeTrendScores(
  inputs: TrendScoreInputs,
  weights: TrendWeights,
): TrendScoreResult {
  const {
    matchingVideos,
    totalVideos,
    matchingCreators,
    totalCreators,
    avgEngagementRate,
    recentCount,
    earlierCount,
  } = inputs;

  const growthRate =
    earlierCount > 0
      ? Math.round(((recentCount - earlierCount) / earlierCount) * 1000) / 10
      : recentCount > 0
        ? 100
        : 0;

  const growthScore = clamp(growthRate / 2, 0, 100);
  const engagementScore =
    avgEngagementRate != null ? clamp(avgEngagementRate * 20, 0, 100) : 0;
  const frequencyScore =
    totalVideos > 0 ? clamp((matchingVideos / totalVideos) * 200, 0, 100) : 0;
  const recencyScore =
    matchingVideos > 0 ? (recentCount / matchingVideos) * 100 : 0;
  const contentGapScore =
    totalCreators > 0
      ? clamp(100 - (matchingCreators / totalCreators) * 100, 0, 100)
      : 100;

  let trendScore =
    weights.growth * growthScore +
    weights.engagement * engagementScore +
    weights.frequency * frequencyScore +
    weights.recency * recencyScore +
    weights.contentGap * contentGapScore;
  let opportunityScore = trendScore * 0.85 + contentGapScore * 0.15;

  if (matchingVideos === 0) {
    trendScore = 0;
    opportunityScore = 0;
  }

  return {
    matchingVideos,
    totalVideos,
    matchingCreators,
    totalCreators,
    growthRate,
    engagementScore: Math.round(engagementScore * 10) / 10,
    frequencyScore: Math.round(frequencyScore * 10) / 10,
    recencyScore: Math.round(recencyScore * 10) / 10,
    contentGapScore: Math.round(contentGapScore * 10) / 10,
    trendScore: Math.round(trendScore * 10) / 10,
    opportunityScore: Math.round(opportunityScore * 10) / 10,
  };
}

export interface TrendScoreQuery {
  projectId?: string;
  keyword?: string;
  hashtag?: string;
  periodDays?: number;
}

@Injectable()
export class TrendScoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get weights(): TrendWeights {
    return {
      growth: Number(this.config.get("TREND_WEIGHT_GROWTH", 0.3)),
      engagement: Number(this.config.get("TREND_WEIGHT_ENGAGEMENT", 0.25)),
      frequency: Number(this.config.get("TREND_WEIGHT_FREQUENCY", 0.2)),
      recency: Number(this.config.get("TREND_WEIGHT_RECENCY", 0.15)),
      contentGap: Number(this.config.get("TREND_WEIGHT_CONTENT_GAP", 0.1)),
    };
  }

  async score(query: TrendScoreQuery): Promise<TrendScoreResult> {
    const keyword = query.keyword?.trim();
    const hashtag = query.hashtag?.trim();
    if (!keyword && !hashtag) {
      throw new BadRequestException(
        "Provide at least one of `keyword` or `hashtag`.",
      );
    }
    const periodDays = query.periodDays ?? 30;
    const recentFrom = new Date(Date.now() - periodDays * 86400000);

    const videoWhere = { isSeedData: false, ...(query.projectId ? { projectId: query.projectId } : {}) };
    const creatorWhere = {
      isSeedData: false,
      ...(query.projectId
        ? { videos: { some: { projectId: query.projectId } } }
        : { videos: { some: {} } }),
    };

    const [totalVideos, totalCreators] = await Promise.all([
      this.prisma.video.count({ where: videoWhere }),
      this.prisma.creator.count({ where: creatorWhere }),
    ]);

    const matching = await this.findMatchingVideos(
      query.projectId,
      keyword,
      hashtag,
    );

    const matchingCreators = new Set(matching.map((v) => v.creatorId)).size;
    const latestMetrics = new Map(
      matching
        .map((v) => v.metrics[0])
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
        .map((m) => [m.videoId, m] as const),
    );
    const engagementRates = matching
      .map((v) => latestMetrics.get(v.id)?.engagementRate)
      .filter((r): r is number => typeof r === "number" && !Number.isNaN(r));
    const avgEngagementRate =
      engagementRates.length > 0
        ? engagementRates.reduce((sum, rate) => sum + rate, 0) /
          engagementRates.length
        : null;

    let recentCount = 0;
    let earlierCount = 0;
    for (const video of matching) {
      if (video.publishedAt && video.publishedAt >= recentFrom) recentCount += 1;
      else earlierCount += 1;
    }

    return computeTrendScores(
      {
        matchingVideos: matching.length,
        totalVideos,
        matchingCreators,
        totalCreators,
        avgEngagementRate,
        recentCount,
        earlierCount,
      },
      this.weights,
    );
  }

  /**
   * Videos matching a hashtag (exact normalized match) and/or a keyword
   * (caption / description / location ILIKE). Each video carries its latest
   * metric snapshot (collectedAt desc, take 1).
   */
  private async findMatchingVideos(
    projectId: string | undefined,
    keyword: string | undefined,
    hashtag: string | undefined,
  ) {
    const normalized =
      hashtag && hashtag.length > 0 ? normalizeHashtag(hashtag) : undefined;

    const conditions: Array<Record<string, unknown>> = [];
    if (normalized) {
      conditions.push({
        hashtags: {
          some: { hashtag: { normalizedName: normalized } },
        },
      });
    }
    if (keyword && keyword.length > 0) {
      const contains = { contains: keyword, mode: "insensitive" as const };
      conditions.push({
        OR: [
          { caption: contains },
          { description: contains },
          { location: contains },
        ],
      });
    }

    const where: Record<string, unknown> = { isSeedData: false };
    if (projectId) where.projectId = projectId;
    if (conditions.length > 0) where.OR = conditions;

    return this.prisma.video.findMany({
      where,
      select: {
        id: true,
        creatorId: true,
        publishedAt: true,
        metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
      },
    });
  }
}
