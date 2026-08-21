import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@traveltok/database";
import { TikTokScraperFactory } from "./tiktok-scraper.factory";
import { NormalizedTikTokVideo } from "./types";

function defined<T extends Record<string, unknown>>(
  value: T,
): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== null && item !== undefined) {
      result[key] = item;
    }
  }
  return result as Partial<T>;
}

/**
 * Runs a scraping job: loads the job record, executes the scraper (Apify or
 * mock), upserts creators/videos/hashtags, records a metric snapshot and
 * updates the job status. Any failure is persisted on the job as FAILED and
 * rethrown so BullMQ also records the failure.
 */
@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scraperFactory: TikTokScraperFactory,
  ) {}

  async process(scrapingJobId: string): Promise<{ processed: number }> {
    const job = await this.prisma.scrapingJob.findUnique({
      where: { id: scrapingJobId },
    });
    if (!job) {
      throw new Error(`Scraping job ${scrapingJobId} not found`);
    }
    if (job.status === "CANCELLED") {
      return { processed: 0 };
    }

    await this.prisma.scrapingJob.update({
      where: { id: scrapingJobId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    try {
      const scraper = this.scraperFactory.create();
      const result = await scraper.scrape({
        keyword: job.keyword,
        hashtag: job.hashtag,
        maxResults: job.maxResults ?? 20,
      });

      await this.persist(job.projectId, result.items);

      await this.prisma.scrapingJob.update({
        where: { id: scrapingJobId },
        data: {
          status: "COMPLETED",
          totalResults: result.items.length,
          processedResults: result.items.length,
          apifyRunId: result.apifyRunId ?? null,
          completedAt: new Date(),
        },
      });
      return { processed: result.items.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Scraping job ${scrapingJobId} failed: ${message}`);
      await this.prisma.scrapingJob.update({
        where: { id: scrapingJobId },
        data: {
          status: "FAILED",
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async persist(
    projectId: string,
    items: NormalizedTikTokVideo[],
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }
    const collectedAt = new Date();

    // Phase 1 — creators. Dedupe by external id first so parallel upserts
    // never race on the same row.
    const creatorsByExternalId = new Map<
      string,
      NormalizedTikTokVideo["creator"]
    >();
    for (const item of items) {
      creatorsByExternalId.set(item.creator.externalId, item.creator);
    }
    const creatorRows = await Promise.all(
      [...creatorsByExternalId.values()].map((creator) =>
        this.prisma.creator.upsert({
          where: { externalId: creator.externalId },
          update: defined({
            username: creator.username,
            displayName: creator.displayName,
            profileUrl: creator.profileUrl,
            avatarUrl: creator.avatarUrl,
            followers: creator.followers,
            following: creator.following,
            totalLikes: creator.totalLikes,
            videoCount: creator.videoCount,
          }),
          create: {
            externalId: creator.externalId,
            username: creator.username,
            displayName: creator.displayName,
            profileUrl: creator.profileUrl,
            avatarUrl: creator.avatarUrl,
            followers: creator.followers,
            following: creator.following,
            totalLikes: creator.totalLikes,
            videoCount: creator.videoCount,
            isSeedData: false,
          },
        }),
      ),
    );
    const creatorIdByExternalId = new Map(
      creatorRows.map((row) => [row.externalId, row.id]),
    );

    // Phase 2 — videos. Every item has a unique external id, so upserts are
    // safe to run in parallel.
    const videoRows = await Promise.all(
      items.map((item) =>
        this.prisma.video.upsert({
          where: { externalId: item.externalId },
          update: defined({
            creatorId: creatorIdByExternalId.get(item.creator.externalId),
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
            caption: item.caption,
            description: item.description,
            duration: item.duration,
            publishedAt: item.publishedAt,
            musicName: item.musicName,
            location: item.location,
          }),
          create: {
            externalId: item.externalId,
            creatorId: creatorIdByExternalId.get(item.creator.externalId)!,
            projectId,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl,
            caption: item.caption,
            description: item.description,
            duration: item.duration,
            publishedAt: item.publishedAt,
            musicName: item.musicName,
            location: item.location,
            isSeedData: false,
          },
        }),
      ),
    );
    const videoIdByExternalId = new Map(
      videoRows.map((row) => [row.externalId, row.id]),
    );

    // Phase 3 — metric snapshots in a single bulk insert (was one query per
    // video before).
    await this.prisma.videoMetric.createMany({
      data: items.map((item) => ({
        videoId: videoIdByExternalId.get(item.externalId)!,
        views: item.metrics.views,
        likes: item.metrics.likes,
        comments: item.metrics.comments,
        shares: item.metrics.shares,
        saves: item.metrics.saves ?? null,
        engagementRate: item.metrics.engagementRate ?? null,
        collectedAt,
        isSeedData: false,
      })),
      skipDuplicates: true,
    });

    // Phase 4 — hashtags. Dedupe, then upsert in parallel.
    const tagNames = new Set<string>();
    for (const item of items) {
      for (const tag of item.hashtags) {
        const normalized = this.normalizeHashtag(tag);
        if (normalized) {
          tagNames.add(normalized);
        }
      }
    }
    const hashtagRows = await Promise.all(
      [...tagNames].map((normalized) =>
        this.prisma.hashtag.upsert({
          where: { normalizedName: normalized },
          update: {},
          create: {
            name: normalized,
            normalizedName: normalized,
            isSeedData: false,
          },
        }),
      ),
    );
    const hashtagIdByName = new Map(
      hashtagRows.map((row) => [row.normalizedName, row.id]),
    );

    // Phase 5 — hashtag links in a single bulk insert.
    const links: Array<{ videoId: string; hashtagId: string }> = [];
    const seen = new Set<string>();
    for (const item of items) {
      const videoId = videoIdByExternalId.get(item.externalId)!;
      for (const tag of item.hashtags) {
        const normalized = this.normalizeHashtag(tag);
        if (!normalized) {
          continue;
        }
        const hashtagId = hashtagIdByName.get(normalized);
        if (!hashtagId) {
          continue;
        }
        const key = `${videoId}:${hashtagId}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        links.push({ videoId, hashtagId });
      }
    }
    if (links.length > 0) {
      await this.prisma.videoHashtag.createMany({
        data: links,
        skipDuplicates: true,
      });
    }
  }

  private normalizeHashtag(tag: string): string | null {
    const normalized = tag.replace(/^#/, "").toLowerCase().trim();
    return normalized.length > 0 ? normalized : null;
  }
}
