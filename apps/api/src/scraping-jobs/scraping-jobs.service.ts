import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService, ScrapingJobStatus } from "@traveltok/database";
import { buildPagination, paginationParams } from "../common/utils/pagination";
import { ScrapingQueueService } from "../scraping/scraping-queue.service";
import { CreateScrapingJobDto } from "./dto/create-scraping-job.dto";

@Injectable()
export class ScrapingJobsService {
  private readonly logger = new Logger(ScrapingJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scrapingQueue: ScrapingQueueService,
  ) {}

  async create(dto: CreateScrapingJobDto, userId?: string) {
    if (!dto.keyword && !dto.hashtag) {
      throw new BadRequestException("Provide at least one of keyword or hashtag");
    }
    if (userId) {
      await this.requireOwnedProject(userId, dto.projectId);
    }
    const job = await this.prisma.scrapingJob.create({
      data: {
        projectId: dto.projectId,
        keyword: dto.keyword,
        hashtag: dto.hashtag,
        maxResults: dto.maxResults,
        status: "QUEUED",
      },
    });

    try {
      await this.scrapingQueue.enqueue(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to enqueue scraping job ${job.id}: ${message}`);
      return this.prisma.scrapingJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: `Enqueue failed: ${message}`,
        },
      });
    }

    return job;
  }

  async list(
    page: number,
    pageSize: number,
    filters: { projectId?: string; status?: ScrapingJobStatus },
    userId?: string,
  ) {
    const where: {
      projectId?: string | { in: string[] };
      status?: ScrapingJobStatus;
    } = {
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    if (userId) {
      const owned = await this.prisma.project.findMany({
        where: { createdById: userId },
        select: { id: true },
      });
      const projectIds = owned.map((p) => p.id);
      if (projectIds.length === 0) {
        return buildPagination([], 0, page, pageSize);
      }
      where.projectId = { in: projectIds };
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.scrapingJob.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.scrapingJob.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }

  async getById(id: string, userId?: string) {
    const job = await this.prisma.scrapingJob.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true, niche: true, createdById: true },
        },
      },
    });
    if (!job || (userId && job.project.createdById !== userId)) {
      throw new NotFoundException("Scraping job not found");
    }
    return job;
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
}
