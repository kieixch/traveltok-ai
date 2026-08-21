import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaService } from "@traveltok/database";
import { allowedSort, buildPagination, paginationParams } from "../common/utils/pagination";
import { SortOrder } from "../common/types/sort-order";

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

@Injectable()
export class VideosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    page: number,
    pageSize: number,
    sort: string,
    order: SortOrder,
    filters: VideoListFilters,
  ) {
    const where = {
      isSeedData: false,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.search
        ? { caption: { contains: filters.search, mode: "insensitive" as const } }
        : {}),
    };
    const sortBy = allowedSort(sort, SORTABLE, "publishedAt");

    if (METRIC_SORT.has(sortBy)) {
      return this.listSortedByMetric(page, pageSize, sortBy as MetricSortField, order, filters);
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.video.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { [sortBy]: order },
        include: videoInclude,
      }),
      this.prisma.video.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }

  /**
   * Sort by engagement values (views/likes/...) — Prisma's to-many relation
   * orderBy only supports `_count`, so we resolve the paginated video ids with
   * a single aggregate query, then hydrate + reorder via the typed client.
   */
  private async listSortedByMetric(
    page: number,
    pageSize: number,
    sortBy: MetricSortField,
    order: SortOrder,
    filters: VideoListFilters,
  ) {
    const where = {
      isSeedData: false,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.search
        ? { caption: { contains: filters.search, mode: "insensitive" as const } }
        : {}),
    };

    const conditions: Prisma.Sql[] = [Prisma.sql`v."isSeedData" = false`];
    if (filters.projectId) {
      conditions.push(Prisma.sql`v."projectId" = ${filters.projectId}`);
    }
    if (filters.search) {
      conditions.push(Prisma.sql`v."caption" ILIKE ${`%${filters.search}%`}`);
    }
    const whereSql =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
        : Prisma.empty;

    const { skip, take } = paginationParams(page, pageSize);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT v."id"
      FROM "Video" v
      LEFT JOIN "VideoMetric" vm ON vm."videoId" = v."id"
      ${whereSql}
      GROUP BY v."id"
      ORDER BY MAX(vm.${Prisma.raw(sortBy)}) ${Prisma.raw(order)} NULLS LAST, v."publishedAt" DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    const ids = rows.map((row) => row.id);
    const total = await this.prisma.video.count({ where });

    let items: Awaited<ReturnType<typeof this.prisma.video.findMany>> = [];
    if (ids.length > 0) {
      items = await this.prisma.video.findMany({
        where: { id: { in: ids } },
        include: videoInclude,
      });
      const rank = new Map(ids.map((id, index) => [id, index]));
      items.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    }

    return buildPagination(items, total, page, pageSize);
  }

  async getById(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: {
        creator: { select: { ...creatorSelect, profileUrl: true } },
        project: { select: { id: true, name: true, niche: true } },
        metrics: { orderBy: { collectedAt: "asc" } },
        hashtags: { include: { hashtag: true } },
        analyses: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!video) {
      throw new NotFoundException("Video not found");
    }
    return video;
  }
}
