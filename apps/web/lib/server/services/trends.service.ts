import { getPrisma } from "@/lib/server/prisma";
import { notFound } from "@/lib/server/http";
import { buildPagination, paginationParams } from "@/lib/server/utils";
import { trendScoreService } from "./trend-score.service";
import type { TrendType } from "@traveltok/database";

export interface CreateTrendInput {
  projectId: string;
  keyword?: string;
  type?: TrendType;
  trendScore?: number | null;
  growthRate?: number | null;
  engagementScore?: number | null;
  frequencyScore?: number | null;
  recencyScore?: number | null;
  opportunityScore?: number | null;
  periodStart?: Date;
  periodEnd?: Date;
}

class TrendsService {
  async create(input: CreateTrendInput) {
    const prisma = getPrisma();
    const periodStart = input.periodStart ?? new Date();
    const periodEnd = input.periodEnd ?? new Date(periodStart.getTime() + 7 * 86400000);

    let computed: Awaited<ReturnType<typeof trendScoreService.score>> | null = null;
    try {
      computed = await trendScoreService.score({
        projectId: input.projectId,
        keyword: input.keyword,
      });
    } catch {
      computed = null;
    }

    return prisma.trend.create({
      data: {
        projectId: input.projectId,
        keyword: input.keyword as string,
        type: input.type ?? "TOPIC",
        trendScore: input.trendScore ?? computed?.trendScore ?? null,
        growthRate: input.growthRate ?? computed?.growthRate ?? null,
        engagementScore: input.engagementScore ?? computed?.engagementScore ?? null,
        frequencyScore: input.frequencyScore ?? computed?.frequencyScore ?? null,
        recencyScore: input.recencyScore ?? computed?.recencyScore ?? null,
        opportunityScore: input.opportunityScore ?? computed?.opportunityScore ?? null,
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
    const prisma = getPrisma();
    const where = {
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.from ? { periodStart: { gte: filters.from } } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.trend.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { createdAt: "desc" },
      }),
      prisma.trend.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }

  async getById(id: string) {
    const trend = await getPrisma().trend.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!trend) {
      throw notFound("Trend not found");
    }
    return trend;
  }
}

export const trendsService = new TrendsService();