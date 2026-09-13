import { Prisma } from "@traveltok/database";
import { getPrisma } from "@/lib/server/prisma";
import { notFound } from "@/lib/server/http";
import { allowedSort, buildPagination, paginationParams } from "@/lib/server/utils";
import { ownedProjectWhere, ownedVideosSql, requireOwnedProject } from "@/lib/server/authz";

const SORTABLE = [
  "scrapedAt",
  "publishedAt",
  "duration",
  "createdAt",
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
] as const;

const METRIC_SORT_FIELDS = ["views", "likes", "comments", "shares", "saves"] as const;
type MetricSortField = (typeof METRIC_SORT_FIELDS)[number];
const METRIC_SORT = new Set<string>(METRIC_SORT_FIELDS);

export interface VideoListFilters {
  projectId?: string;
  search?: string;
}

const creatorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

const videoInclude = {
  creator: { select: creatorSelect },
  metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
} as const;

export class VideosService {
  async list(
    page: number,
    pageSize: number,
    sort: string,
    order: "asc" | "desc",
    filters: VideoListFilters,
    userId: string,
  ) {
    const prisma = getPrisma();
    const projectWhere = filters.projectId
      ? { projectId: await requireOwnedProject(userId, filters.projectId) }
      : ownedProjectWhere(userId);
    const where = {
      isSeedData: false,
      ...projectWhere,
      ...(filters.search
        ? { caption: { contains: filters.search, mode: "insensitive" as const } }
        : {}),
    };
    const sortBy = allowedSort(sort, SORTABLE, "publishedAt");

    if (METRIC_SORT.has(sortBy)) {
      return this.listSortedByMetric(page, pageSize, sortBy as MetricSortField, order, filters, userId);
    }

    const [items, total] = await prisma.$transaction([
      prisma.video.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { [sortBy]: order as Prisma.SortOrder },
        include: videoInclude,
      }),
      prisma.video.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }

  private async listSortedByMetric(
    page: number,
    pageSize: number,
    sortBy: MetricSortField,
    order: "asc" | "desc",
    filters: VideoListFilters,
    userId: string,
  ) {
    const prisma = getPrisma();
    if (filters.projectId) {
      await requireOwnedProject(userId, filters.projectId);
    }
    const where = {
      isSeedData: false,
      ...(filters.projectId ? { projectId: filters.projectId } : ownedProjectWhere(userId)),
      ...(filters.search
        ? { caption: { contains: filters.search, mode: "insensitive" as const } }
        : {}),
    };

    const conditions: Prisma.Sql[] = [Prisma.sql`v."isSeedData" = false`];
    if (filters.projectId) {
      conditions.push(Prisma.sql`v."projectId" = ${filters.projectId}`);
    } else {
      conditions.push(ownedVideosSql("projectId", userId));
    }
    if (filters.search) {
      conditions.push(Prisma.sql`v."caption" ILIKE ${`%${filters.search}%`}`);
    }
    const whereSql =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
        : Prisma.empty;

    const { skip, take } = paginationParams(page, pageSize);
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT v."id"
      FROM "Video" v
      LEFT JOIN "VideoMetric" vm ON vm."videoId" = v."id"
      ${whereSql}
      GROUP BY v."id"
      ORDER BY MAX(vm.${Prisma.raw(sortBy)}) ${Prisma.raw(order)} NULLS LAST, v."publishedAt" DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    const ids = rows.map((row) => row.id);
    const total = await prisma.video.count({ where });

    let items: Awaited<ReturnType<typeof prisma.video.findMany>> = [];
    if (ids.length > 0) {
      items = await prisma.video.findMany({
        where: { id: { in: ids } },
        include: videoInclude,
      });
      const rank = new Map(ids.map((id, index) => [id, index]));
      items.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    }

    return buildPagination(items, total, page, pageSize);
  }

  async getById(id: string, userId: string) {
    const video = await getPrisma().video.findUnique({
      where: { id },
      include: {
        creator: { select: { ...creatorSelect, profileUrl: true } },
        project: { select: { id: true, name: true, niche: true, createdById: true } },
        metrics: { orderBy: { collectedAt: "asc" } },
        hashtags: { include: { hashtag: true } },
        analyses: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!video || video.project.createdById !== userId) {
      throw notFound("Video not found");
    }
    return video;
  }
}

export const videosService = new VideosService();