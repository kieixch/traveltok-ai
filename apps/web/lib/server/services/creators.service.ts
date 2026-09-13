import { Prisma } from "@traveltok/database";
import { getPrisma } from "@/lib/server/prisma";
import { notFound } from "@/lib/server/http";
import { allowedSort, buildPagination } from "@/lib/server/utils";
import { requireOwnedProject } from "@/lib/server/authz";

const SORTABLE = [
  "followers",
  "following",
  "videoCount",
  "totalLikes",
  "totalViews",
  "avgEngagementRate",
  "createdAt",
] as const;

const SORT_COLUMNS: Record<string, string> = {
  followers: 'c."followers"',
  following: 'c."following"',
  totalLikes: 'c."totalLikes"',
  createdAt: 'c."createdAt"',
  videoCount: 'agg."videoCount"',
  totalViews: 'agg."totalViews"',
  avgEngagementRate: 'agg."avgEngagementRate"',
};

const toNumber = (value: bigint | number): number => Number(value);

export interface CreatorListFilters {
  search?: string;
  projectId?: string;
  minFollowers?: number;
  minViews?: number;
  minEngagement?: number;
}

class CreatorsService {
  async list(
    page: number,
    pageSize: number,
    sort: string,
    order: "asc" | "desc",
    filters: CreatorListFilters = {},
    userId: string,
  ) {
    const prisma = getPrisma();
    const { search, projectId, minFollowers, minViews, minEngagement } = filters;

    if (projectId) {
      await requireOwnedProject(userId, projectId);
    }

    const ownedScope = Prisma.sql`v."projectId" IN (SELECT p."id" FROM "Project" p WHERE p."createdById" = ${userId})`;
    const videoJoin = projectId
      ? Prisma.sql`JOIN "Video" v ON v."creatorId" = c."id" AND v."isSeedData" = false AND v."projectId" = ${projectId}`
      : Prisma.sql`JOIN "Video" v ON v."creatorId" = c."id" AND v."isSeedData" = false AND ${ownedScope}`;
    const searchClause = search
      ? Prisma.sql`AND (c."username" ILIKE ${`%${search}%`} OR c."displayName" ILIKE ${`%${search}%`})`
      : Prisma.empty;
    const minFollowersClause = minFollowers
      ? Prisma.sql`AND c."followers" >= ${minFollowers}`
      : Prisma.empty;
    const minViewsClause = minViews
      ? Prisma.sql`AND agg."totalViews" >= ${minViews}`
      : Prisma.empty;
    const minEngagementClause = minEngagement
      ? Prisma.sql`AND agg."avgEngagementRate" >= ${minEngagement}`
      : Prisma.empty;

    const sortBy = allowedSort(sort, SORTABLE, "followers");
    const orderByRaw = `${SORT_COLUMNS[sortBy]} ${order} NULLS LAST`;

    const conditions = Prisma.sql`
      WHERE c."isSeedData" = false
      ${searchClause}
      ${minFollowersClause}
      ${minViewsClause}
      ${minEngagementClause}
    `;

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        externalId: string | null;
        username: string;
        displayName: string | null;
        profileUrl: string | null;
        avatarUrl: string | null;
        followers: number | null;
        following: number | null;
        totalLikes: number | null;
        videoCount: number;
        totalViews: bigint;
        avgEngagementRate: number;
        createdAt: Date;
      }>
    >`
      WITH latest AS (
        SELECT DISTINCT ON (m."videoId")
          m."videoId", m."views", m."engagementRate"
        FROM "VideoMetric" m
        ORDER BY m."videoId", m."collectedAt" DESC
      ),
      agg AS (
        SELECT
          c."id",
          COUNT(v."id")::int AS "videoCount",
          COALESCE(SUM(lm."views"), 0)::bigint AS "totalViews",
          ROUND(COALESCE(AVG(lm."engagementRate"), 0)::numeric, 4)::float
            AS "avgEngagementRate"
        FROM "Creator" c
        ${videoJoin}
        LEFT JOIN latest lm ON lm."videoId" = v."id"
        GROUP BY c."id"
      )
      SELECT
        c."id", c."externalId", c."username", c."displayName",
        c."profileUrl", c."avatarUrl", c."followers", c."following",
        c."totalLikes", c."createdAt",
        agg."videoCount", agg."totalViews", agg."avgEngagementRate"
      FROM "Creator" c
      JOIN agg ON agg."id" = c."id"
      ${conditions}
      ORDER BY ${Prisma.raw(orderByRaw)}
      LIMIT ${pageSize}
      OFFSET ${(page - 1) * pageSize}
    `;

    const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
      WITH latest AS (
        SELECT DISTINCT ON (m."videoId")
          m."videoId", m."views", m."engagementRate"
        FROM "VideoMetric" m
        ORDER BY m."videoId", m."collectedAt" DESC
      ),
      agg AS (
        SELECT
          c."id",
          COALESCE(SUM(lm."views"), 0)::bigint AS "totalViews",
          ROUND(COALESCE(AVG(lm."engagementRate"), 0)::numeric, 4)::float
            AS "avgEngagementRate"
        FROM "Creator" c
        ${videoJoin}
        LEFT JOIN latest lm ON lm."videoId" = v."id"
        GROUP BY c."id"
      )
      SELECT COUNT(*)::bigint AS "total"
      FROM "Creator" c
      JOIN agg ON agg."id" = c."id"
      ${conditions}
    `;

    const items = rows.map((row) => ({
      id: row.id,
      externalId: row.externalId,
      username: row.username,
      displayName: row.displayName,
      profileUrl: row.profileUrl,
      avatarUrl: row.avatarUrl,
      followers: row.followers,
      following: row.following,
      totalLikes: row.totalLikes,
      videoCount: row.videoCount,
      totalViews: toNumber(row.totalViews),
      avgEngagementRate: row.avgEngagementRate,
      createdAt: row.createdAt,
    }));

    const total = toNumber(countRows[0]?.total ?? 0);
    return buildPagination(items, total, page, pageSize);
  }

  async getById(id: string, userId: string) {
    const creator = await getPrisma().creator.findFirst({
      where: { id, videos: { some: { project: { createdById: userId } } } },
      select: {
        id: true,
        externalId: true,
        username: true,
        displayName: true,
        profileUrl: true,
        avatarUrl: true,
        followers: true,
        following: true,
        totalLikes: true,
        videoCount: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { videos: true } },
      },
    });
    if (!creator) {
      throw notFound("Creator not found");
    }
    return creator;
  }
}

export const creatorsService = new CreatorsService();