import { getPrisma } from "@/lib/server/prisma";
import { badRequest, notFound } from "@/lib/server/http";
import { buildPagination, paginationParams } from "@/lib/server/utils";
import { ScrapingJobStatus } from "@traveltok/database";
import { createScraper } from "../scraping/scraper.factory";
import { NormalizedTikTokVideo } from "../scraping/types";
import { runScrapingJob } from "../scraping/runner";

export interface CreateScrapingJobInput {
  projectId: string;
  keyword?: string;
  hashtag?: string;
  maxResults?: number;
}

export class ScrapingJobsService {
  /**
   * Creates a job and either completes it synchronously (mock mode) or starts
   * an Apify run async with a webhook that completes it serverlessly.
   */
  async create(input: CreateScrapingJobInput, userId?: string) {
    const prisma = getPrisma();
    if (!input.keyword && !input.hashtag) {
      throw badRequest("Provide at least one of keyword or hashtag");
    }
    if (userId) {
      await this.requireOwnedProject(userId, input.projectId);
    }
    const job = await prisma.scrapingJob.create({
      data: {
        projectId: input.projectId,
        keyword: input.keyword,
        hashtag: input.hashtag,
        maxResults: input.maxResults,
        status: "QUEUED",
      },
    });

    try {
      const { dispatched, apifyRunId } = await this.dispatch(job.id, input.maxResults);
      return prisma.scrapingJob.findUniqueOrThrow({ where: { id: job.id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return prisma.scrapingJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: `Scraping failed: ${message}`,
          completedAt: new Date(),
        },
      });
    }
  }

  private async dispatch(jobId: string, maxResults?: number) {
    const job = await getPrisma().scrapingJob.findUniqueOrThrow({ where: { id: jobId } });
    const scraper = createScraper();

    if (scraper instanceof (await import("../scraping/tiktok-scraper")).TikTokScraper) {
      const baseUrl = process.env.WEBHOOK_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
      const secret = process.env.SCRAPE_WEBHOOK_SECRET ?? "";
      const webhookUrl = `${baseUrl}/api/scraping-jobs/${jobId}/complete?token=${encodeURIComponent(secret)}`;
      const apifyRunId = await scraper.start(
        { keyword: job.keyword, hashtag: job.hashtag, maxResults: maxResults ?? 20 },
        webhookUrl,
      );
      await getPrisma().scrapingJob.update({
        where: { id: jobId },
        data: { status: "RUNNING", apifyRunId, startedAt: new Date() },
      });
      return { dispatched: true, apifyRunId };
    }

    await runScrapingJob(jobId);
    return { dispatched: false, apifyRunId: undefined };
  }

  /**
   * Completes a job from an Apify webhook: fetches the dataset + persists.
   * Returns false when the run did not truly succeed (job already FAILED by
   * the webhook error path).
   */
  async completeFromWebhook(jobId: string, apifyRunId: string): Promise<boolean> {
    const job = await getPrisma().scrapingJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw notFound("Scraping job not found");
    }
    const scraper = createScraper();
    if (!(scraper instanceof (await import("../scraping/tiktok-scraper")).TikTokScraper)) {
      throw badRequest("Not an Apify scraping job");
    }
    const result = await scraper.fetchResult(apifyRunId, job.maxResults ?? 20);
    await getPrisma().scrapingJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        apifyRunId,
        startedAt: job.startedAt ?? new Date(),
      },
    });
    await persistResults(job.projectId, result.items);
    await getPrisma().scrapingJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        totalResults: result.items.length,
        processedResults: result.items.length,
        apifyRunId: result.apifyRunId ?? apifyRunId,
        completedAt: new Date(),
      },
    });
    return true;
  }

  async list(
    page: number,
    pageSize: number,
    filters: { projectId?: string; status?: ScrapingJobStatus },
    userId?: string,
  ) {
    const prisma = getPrisma();
    const where: {
      projectId?: string | { in: string[] };
      status?: ScrapingJobStatus;
    } = {
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    if (userId) {
      const owned = await prisma.project.findMany({
        where: { createdById: userId },
        select: { id: true },
      });
      const projectIds = owned.map((p) => p.id);
      if (projectIds.length === 0) {
        return buildPagination([], 0, page, pageSize);
      }
      where.projectId = { in: projectIds };
    }
    const [items, total] = await prisma.$transaction([
      prisma.scrapingJob.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { createdAt: "desc" },
      }),
      prisma.scrapingJob.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }

  async getById(id: string, userId?: string) {
    const job = await getPrisma().scrapingJob.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true, niche: true, createdById: true },
        },
      },
    });
    if (!job || (userId && job.project.createdById !== userId)) {
      throw notFound("Scraping job not found");
    }
    return job;
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
}

export const scrapingJobsService = new ScrapingJobsService();

export async function persistResults(
  projectId: string,
  items: NormalizedTikTokVideo[],
): Promise<void> {
  if (items.length === 0) return;
  const prisma = getPrisma();
  const collectedAt = new Date();

  function defined<T extends Record<string, unknown>>(value: T): Partial<T> {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== null && item !== undefined) result[key] = item;
    }
    return result as Partial<T>;
  }

  const creatorsByExternalId = new Map<
    string,
    NormalizedTikTokVideo["creator"]
  >();
  for (const item of items) {
    creatorsByExternalId.set(item.creator.externalId, item.creator);
  }
  const creatorRows = await Promise.all(
    [...creatorsByExternalId.values()].map((creator) =>
      prisma.creator.upsert({
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

  const videoRows = await Promise.all(
    items.map((item) =>
      prisma.video.upsert({
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

  await prisma.videoMetric.createMany({
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
}

/** Strips the leading `#`, lowercases and trims a hashtag. */
export function normalizeHashtag(tag: string): string | null {
  const normalized = tag.replace(/^#/, "").toLowerCase().trim();
  return normalized.length > 0 ? normalized : null;
}

export const SCRAPING_QUEUE_NAME = "scraping";
export const SCRAPING_JOB_NAME = "scrape-tiktok";