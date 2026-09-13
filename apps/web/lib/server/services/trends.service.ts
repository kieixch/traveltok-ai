import { getPrisma } from "@/lib/server/prisma";
import { notFound } from "@/lib/server/http";
import { buildPagination, paginationParams } from "@/lib/server/utils";
import { trendScoreService } from "./trend-score.service";
import type { TrendType } from "@traveltok/database";
import { ownedProjectWhere, requireOwnedProject } from "@/lib/server/authz";

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
  async create(input: CreateTrendInput, userId: string) {
    const prisma = getPrisma();
    const projectId = await requireOwnedProject(userId, input.projectId);
    const periodStart = input.periodStart ?? new Date();
    const periodEnd = input.periodEnd ?? new Date(periodStart.getTime() + 7 * 86400000);

    let computed: Awaited<ReturnType<typeof trendScoreService.score>> | null = null;
    try {
      computed = await trendScoreService.score({
        projectId,
        keyword: input.keyword,
      }, userId);
    } catch {
      computed = null;
    }

    return prisma.trend.create({
      data: {
        projectId,
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
    userId: string,
  ) {
    const prisma = getPrisma();
    const projectWhere = filters.projectId
      ? { projectId: await requireOwnedProject(userId, filters.projectId) }
      : ownedProjectWhere(userId);
    const where = {
      ...projectWhere,
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

  async getById(id: string, userId: string) {
    const trend = await getPrisma().trend.findUnique({
      where: { id },
      include: { project: { select: { id: true, name: true, createdById: true } } },
    });
    if (!trend || trend.project.createdById !== userId) {
      throw notFound("Trend not found");
    }
    return trend;
  }
}

export const trendsService = new TrendsService();