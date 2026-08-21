import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@traveltok/database";
import { buildPagination, paginationParams } from "../common/utils/pagination";
import { ScrapingJobsService } from "../scraping-jobs/scraping-jobs.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ScrapeProjectDto } from "./dto/scrape-project.dto";
import { EmbeddingsService } from "../search/embeddings.service";

export interface DemoDataResult {
  videos: number;
  metrics: number;
  hashtagLinks: number;
  creators: number;
  hashtags: number;
  scrapingJobs: number;
  embeddings: number;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly scrapingJobsService: ScrapingJobsService,
  ) {}

  async create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        niche: dto.niche,
        createdById: userId,
      },
    });
  }

  async list(userId: string, page: number, pageSize: number, search?: string) {
    const where = {
      createdById: userId,
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.project.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }

  async getById(userId: string, id: string) {
    return this.findOwnedOrThrow(userId, id);
  }

  async update(userId: string, id: string, dto: UpdateProjectDto) {
    await this.findOwnedOrThrow(userId, id);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.findOwnedOrThrow(userId, id);
    return this.prisma.project.delete({ where: { id } });
  }

  /**
   * Clones the seed dataset (videos, metrics, hashtag links, jobs) into a
   * user-owned project so a fresh account can explore the dashboard without
   * running real scrapers. Creators and hashtags are global records and are
   * reused; video/metric rows are recreated with unique external IDs. The
   * operation is idempotent — re-running only creates what is still missing.
   */
  async addDemoData(userId: string, projectId: string): Promise<DemoDataResult> {
    await this.findOwnedOrThrow(userId, projectId);

    const seedProject = await this.prisma.project.findFirst({
      where: { isSeedData: true },
      select: { id: true },
    });
    if (!seedProject) {
      throw new BadRequestException(
        "Seed dataset not found — run `npm run db:seed` first.",
      );
    }

    const prefix = `demo-${projectId.slice(0, 8)}`;
    const existing = await this.prisma.video.findMany({
      where: { projectId },
      select: { externalId: true },
    });
    const existingIds = new Set(existing.map((v) => v.externalId));

    return this.prisma.$transaction(async (tx) => {
      const seedCreators = await tx.creator.findMany({
        where: { videos: { some: { projectId: seedProject.id } } },
      });
      const seedHashtags = await tx.hashtag.findMany({});
      const seedVideos = await tx.video.findMany({
        where: { projectId: seedProject.id },
      });
      const seedMetrics = await tx.videoMetric.findMany({
        where: { video: { projectId: seedProject.id } },
      });
      const seedLinks = await tx.videoHashtag.findMany({
        where: { video: { projectId: seedProject.id } },
      });

      const creatorIds = new Map<string, string>();
      for (const creator of seedCreators) {
        const existingCreator = await tx.creator.findUnique({
          where: { externalId: creator.externalId },
          select: { id: true },
        });
        const targetId = existingCreator?.id ?? creator.id;
        if (!existingCreator) {
          await tx.creator.update({
            where: { id: creator.id },
            data: { isSeedData: false },
          });
        }
        creatorIds.set(creator.id, targetId);
      }

      const hashtagIds = new Map<string, string>();
      for (const tag of seedHashtags) {
        const existingTag = await tx.hashtag.findUnique({
          where: { normalizedName: tag.normalizedName },
          select: { id: true },
        });
        const targetId = existingTag?.id ?? tag.id;
        if (!existingTag) {
          await tx.hashtag.update({
            where: { id: tag.id },
            data: { isSeedData: false },
          });
        }
        hashtagIds.set(tag.id, targetId);
      }

      const videoIds = new Map<string, string>();
      let createdVideos = 0;
      for (const video of seedVideos) {
        const externalId = `${prefix}-${video.externalId}`;
        if (existingIds.has(externalId)) continue;
        const created = await tx.video.create({
          data: {
            externalId,
            creatorId: creatorIds.get(video.creatorId)!,
            projectId,
            url: video.url,
            thumbnailUrl: video.thumbnailUrl,
            caption: video.caption,
            description: video.description,
            duration: video.duration,
            publishedAt: video.publishedAt,
            musicName: video.musicName,
            location: video.location,
            isSeedData: false,
          },
        });
        videoIds.set(video.id, created.id);
        existingIds.add(externalId);
        createdVideos += 1;
      }

      const metricPromises = seedMetrics
        .filter((m) => videoIds.has(m.videoId))
        .map((m) =>
          tx.videoMetric.create({
            data: {
              videoId: videoIds.get(m.videoId)!,
              views: m.views,
              likes: m.likes,
              comments: m.comments,
              shares: m.shares,
              saves: m.saves,
              engagementRate: m.engagementRate,
              collectedAt: m.collectedAt,
              isSeedData: false,
            },
          }),
        );

      const linkPromises = seedLinks
        .filter((l) => videoIds.has(l.videoId))
        .map((l) =>
          tx.videoHashtag.create({
            data: {
              videoId: videoIds.get(l.videoId)!,
              hashtagId: hashtagIds.get(l.hashtagId)!,
            },
          }),
        );

      const [metrics] = await Promise.all([
        Promise.all(metricPromises),
        Promise.all(linkPromises),
      ]);

      const seedJobs = await tx.scrapingJob.findMany({
        where: { projectId: seedProject.id },
      });
      const jobPromises = seedJobs.map((job) =>
        tx.scrapingJob.create({
          data: {
            projectId,
            keyword: job.keyword,
            hashtag: job.hashtag,
            maxResults: job.maxResults,
            status: job.status,
            apifyRunId: job.apifyRunId,
            totalResults: job.totalResults,
            processedResults: job.processedResults,
            errorMessage: job.errorMessage,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            isSeedData: false,
          },
        }),
      );
      await Promise.all(jobPromises);

      return {
        videos: createdVideos,
        metrics: metrics.length,
        hashtagLinks: linkPromises.length,
        creators: creatorIds.size,
        hashtags: hashtagIds.size,
        scrapingJobs: seedJobs.length,
        embeddings: 0,
      };
    }).then(async (result) => {
      const index = await this.embeddingsService.indexProject(userId, projectId);
      return { ...result, embeddings: index.videos };
    });
  }

  /**
   * Queues a real scraping job for an owned project. The keyword/hashtag come
   * from the request or, when both are absent, from the project niche.
   */
  async scrape(userId: string, projectId: string, dto: ScrapeProjectDto) {
    const project = await this.findOwnedOrThrow(userId, projectId);

    const keyword = dto.keyword?.trim() || undefined;
    const hashtag = dto.hashtag?.trim() || undefined;

    const resolvedHashtag =
      hashtag ?? (keyword ? undefined : this.nicheToHashtag(project.niche));
    const resolvedKeyword = keyword;

    if (!resolvedHashtag && !resolvedKeyword) {
      throw new BadRequestException(
        "Provide a keyword or hashtag (or set the project niche) to scrape",
      );
    }

    return this.scrapingJobsService.create(
      {
        projectId,
        keyword: resolvedKeyword,
        hashtag: resolvedHashtag,
        maxResults: dto.maxResults,
      },
      userId,
    );
  }

  /** `"Bali Travel"` → `balitravel` (TikTok hashtag-friendly). */
  private nicheToHashtag(niche: string | null | undefined): string | undefined {
    if (!niche) return undefined;
    const slug = niche.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return slug.slice(0, 40) || undefined;
  }

  private async findOwnedOrThrow(userId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, createdById: userId },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
    return project;
  }
}
