import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService, TrendType } from "@traveltok/database";
import { TrendScoreService } from "../analytics/trend-score.service";
import { buildPagination, paginationParams } from "../common/utils/pagination";
import { CreateTrendDto } from "./dto/create-trend.dto";

@Injectable()
export class TrendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trendScoreService: TrendScoreService,
  ) {}

  async create(dto: CreateTrendDto) {
    const periodStart = dto.periodStart ?? new Date();
    const periodEnd = dto.periodEnd ?? new Date(periodStart.getTime() + 7 * 86400000);

    let computed:
      | Awaited<ReturnType<typeof this.trendScoreService.score>>
      | null = null;
    try {
      computed = await this.trendScoreService.score({
        projectId: dto.projectId,
        keyword: dto.keyword,
      });
    } catch {
      computed = null;
    }

    return this.prisma.trend.create({
      data: {
        projectId: dto.projectId,
        keyword: dto.keyword,
        type: dto.type ?? "TOPIC",
        trendScore: dto.trendScore ?? computed?.trendScore ?? null,
        growthRate: dto.growthRate ?? computed?.growthRate ?? null,
        engagementScore: dto.engagementScore ?? computed?.engagementScore ?? null,
        frequencyScore: dto.frequencyScore ?? computed?.frequencyScore ?? null,
        recencyScore: dto.recencyScore ?? computed?.recencyScore ?? null,
        opportunityScore: dto.opportunityScore ?? computed?.opportunityScore ?? null,
        periodStart,
        periodEnd,
      },
    });
  }

  async list(
    page: number,
    pageSize: number,
    filters: { projectId?: string; type?: TrendType; from?: Date },
  ) {
    const where = {
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.from ? { periodStart: { gte: filters.from } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.trend.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.trend.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }

  async getById(id: string) {
    const trend = await this.prisma.trend.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!trend) {
      throw new NotFoundException("Trend not found");
    }
    return trend;
  }
}
