import { Injectable } from "@nestjs/common";
import { PrismaService } from "@traveltok/database";

export type OpportunityType =
  | "DESTINATION"
  | "HASHTAG"
  | "TOPIC"
  | "FORMAT"
  | "HOOK";

export interface Opportunity {
  type: OpportunityType;
  label: string;
  opportunityScore: number;
  demandScore: number;
  engagementScore: number;
  growthScore: number;
  coverage: number;
  coverageRatio: number;
  avgEngagementRate: number;
  trendScore: number | null;
  reasoning: string;
  topVideos: Array<{
    id: string;
    caption: string | null;
    views: number;
  }>;
}

interface VideoWithContext {
  id: string;
  caption: string | null;
  location: string | null;
  engagementRate: number | null;
  views: number;
  destinations: string[];
  topics: string[];
  formats: string[];
  hooks: string[];
  hashtags: string[];
}

interface Candidate {
  type: OpportunityType;
  label: string;
  videoIds: string[];
  avgEngagementRate: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Deterministic opportunity detection. Every segment (destination, hashtag,
 * topic, format, hook) found in the project's dataset is scored from three
 * explainable components:
 *
 *   demand      – how prevalent the segment is (coverage ratio)
 *   engagement  – how well those videos perform vs the best segment
 *   growth      – the matching Trend.trendScore when present (modest default)
 *
 *   opportunity = 0.4·demand + 0.35·engagement + 0.25·growth  →  0..100
 */
@Injectable()
export class OpportunityService {
  constructor(private readonly prisma: PrismaService) {}

  async findOpportunities(
    projectId: string | undefined,
    limit = 10,
  ): Promise<Opportunity[]> {
    const videoWhere = { isSeedData: false, ...(projectId ? { projectId } : {}) };
    const trendWhere = { isSeedData: false, ...(projectId ? { projectId } : {}) };

    const [videos, trends] = await Promise.all([
      this.prisma.video.findMany({
        where: videoWhere,
        include: {
          metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
          analyses: { orderBy: { createdAt: "desc" }, take: 1 },
          hashtags: {
            include: { hashtag: { select: { name: true } } },
          },
        },
      }),
      this.prisma.trend.findMany({
        where: trendWhere,
        select: { keyword: true, trendScore: true },
      }),
    ]);

    const context: VideoWithContext[] = videos.map((video) => {
      const metric = video.metrics[0];
      const analysis = video.analyses[0];
      return {
        id: video.id,
        caption: video.caption,
        location: video.location,
        engagementRate: metric?.engagementRate ?? null,
        views: metric ? Number(metric.views) : 0,
        destinations: [analysis?.destination ?? video.location]
          .filter((value): value is string => !!value),
        topics: analysis?.topic ? [analysis.topic] : [],
        formats: analysis?.contentFormat ? [analysis.contentFormat] : [],
        hooks: analysis?.hookType ? [analysis.hookType] : [],
        hashtags: video.hashtags.map((vh) => vh.hashtag.name),
      };
    });

    const candidates = this.buildCandidates(context);

    const maxEngagement = Math.max(
      ...candidates.map((c) => c.avgEngagementRate),
      0.0001,
    );

    const opportunities: Opportunity[] = candidates.map((candidate) => {
      const demand = clamp01(candidate.videoIds.length / Math.max(context.length, 1));
      const engagement = clamp01(candidate.avgEngagementRate / maxEngagement);
      const trend = trends.find((t) =>
        t.keyword.toLowerCase().includes(candidate.label.toLowerCase()) ||
        candidate.label.toLowerCase().includes(t.keyword.toLowerCase()),
      );
      const growth = trend?.trendScore
        ? clamp01(trend.trendScore / 100)
        : 0.15;

      const score = Math.round(
        (demand * 0.4 + engagement * 0.35 + growth * 0.25) * 100,
      );

      const evidence = context
        .filter((video) => candidate.videoIds.includes(video.id))
        .sort((a, b) => b.views - a.views)
        .slice(0, 3)
        .map((video) => ({ id: video.id, caption: video.caption, views: video.views }));

      const growthText = trend?.trendScore
        ? `The trend score of ${trend.trendScore.toFixed(1)}/100 signals it is growing.`
        : "No tracked trend yet — start one to unlock growth signals.";

      return {
        type: candidate.type,
        label: candidate.label,
        opportunityScore: score,
        demandScore: Math.round(demand * 100) / 100,
        engagementScore: Math.round(engagement * 100) / 100,
        growthScore: Math.round(growth * 100) / 100,
        coverage: candidate.videoIds.length,
        coverageRatio: Math.round(demand * 100) / 100,
        avgEngagementRate:
          Math.round(candidate.avgEngagementRate * 1000) / 1000,
        trendScore: trend?.trendScore ?? null,
        reasoning:
          `${candidate.label} appears in ${candidate.videoIds.length} videos ` +
          `(${Math.round(demand * 100)}% of the dataset) averaging ` +
          `${candidate.avgEngagementRate.toFixed(2)}% engagement. ${growthText}`,
        topVideos: evidence,
      };
    });

    return opportunities
      .sort(
        (a, b) =>
          b.opportunityScore - a.opportunityScore ||
          b.coverage - a.coverage,
      )
      .slice(0, limit);
  }

  private buildCandidates(videos: VideoWithContext[]): Candidate[] {
    const map = new Map<string, Candidate>();

    const add = (type: OpportunityType, label: string, videoId: string) => {
      if (!label) return;
      const key = `${type}:${label.toLowerCase()}`;
      let candidate = map.get(key);
      if (!candidate) {
        candidate = { type, label, videoIds: [], avgEngagementRate: 0 };
        map.set(key, candidate);
      }
      if (!candidate.videoIds.includes(videoId)) {
        candidate.videoIds.push(videoId);
      }
    };

    for (const video of videos) {
      for (const destination of video.destinations) add("DESTINATION", destination, video.id);
      for (const topic of video.topics) add("TOPIC", topic, video.id);
      for (const format of video.formats) add("FORMAT", format, video.id);
      for (const hook of video.hooks) add("HOOK", hook, video.id);
      for (const hashtag of video.hashtags) add("HASHTAG", hashtag, video.id);
    }

    return [...map.values()].map((candidate) => {
      const rates = videos
        .filter((v) => candidate.videoIds.includes(v.id))
        .map((v) => v.engagementRate)
        .filter((rate): rate is number => rate !== null);
      return {
        ...candidate,
        avgEngagementRate:
          rates.length > 0
            ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length
            : 0,
      };
    });
  }
}
