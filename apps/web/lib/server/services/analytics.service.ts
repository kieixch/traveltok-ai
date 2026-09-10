import { Prisma } from "@traveltok/database";
import { getPrisma } from "@/lib/server/prisma";

export interface Overview {
  projectId: string;
  videoCount: number;
  creatorCount: number;
  hashtagCount: number;
  completedJobs: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  avgViews: number;
  avgEngagementRate: number;
  videosLast30d: number;
  topVideo: {
    id: string;
    caption: string | null;
    url: string | null;
    views: number;
    creatorUsername: string | null;
  } | null;
  topCreator: {
    id: string;
    username: string;
    profileUrl: string | null;
    followers: number | null;
    videoCount: number;
  } | null;
}

export interface EngagementBucket {
  bucket: string;
  count: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  avgEngagementRate: number;
}

export interface TopCreator {
  id: string;
  externalId: string | null;
  username: string;
  displayName: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  followers: number | null;
  videoCount: number;
  totalViews: number;
  avgViews: number;
  avgEngagementRate: number;
}

export interface HashtagPerformance {
  id: string;
  name: string;
  normalizedName: string;
  videoCount: number;
  totalViews: number;
  avgEngagementRate: number;
}

const toNumber = (value: bigint | number): number => Number(value);

/** CTE resolving the latest metric snapshot per video, optionally scoped to one project. */
function latestMetricCte(projectId?: string): Prisma.Sql {
  return Prisma.sql`
    latest AS (
      SELECT DISTINCT ON (m."videoId")
        m."videoId", m."views", m."likes", m."comments", m."shares",
        m."saves", m."engagementRate"
      FROM "VideoMetric" m
      JOIN "Video" v ON v."id" = m."videoId"
      WHERE v."isSeedData" = FALSE
        AND (${projectId}::text IS NULL OR v."projectId" = ${projectId ?? ""})
      ORDER BY m."videoId", m."collectedAt" DESC
    )
  `;
}

class AnalyticsService {
  async overview(projectId?: string): Promise<Overview> {
    const prisma = getPrisma();
    const since30d = new Date(Date.now() - 30 * 86400000);
    const videoWhere = { isSeedData: false, ...(projectId ? { projectId } : {}) };
    const creatorWhere = { isSeedData: false, ...(projectId ? { videos: { some: { projectId } } } : { videos: { some: {} } }) };
    const hashtagWhere = { isSeedData: false, ...(projectId ? { videos: { some: { video: { projectId } } } } : { videos: { some: {} } }) };
    const jobWhere = { isSeedData: false, ...(projectId ? { projectId, status: "COMPLETED" as const } : { status: "COMPLETED" as const }) };
    const recentWhere = { isSeedData: false, ...(projectId ? { projectId, publishedAt: { gte: since30d } } : { publishedAt: { gte: since30d } }) };

    const [videoCount, creatorCount, hashtagCount, completedJobs, videosLast30d, aggregate, topVideo, topCreator] =
      await Promise.all([
        prisma.video.count({ where: videoWhere }),
        prisma.creator.count({ where: creatorWhere }),
        prisma.hashtag.count({ where: hashtagWhere }),
        prisma.scrapingJob.count({ where: jobWhere }),
        prisma.video.count({ where: recentWhere }),
        this.aggregateMetrics(projectId),
        this.topVideo(projectId),
        this.topCreator(projectId),
      ]);

    return {
      projectId: projectId ?? "all",
      videoCount,
      creatorCount,
      hashtagCount,
      completedJobs,
      totalViews: toNumber(aggregate.totalViews),
      totalLikes: toNumber(aggregate.totalLikes),
      totalComments: toNumber(aggregate.totalComments),
      totalShares: toNumber(aggregate.totalShares),
      totalSaves: toNumber(aggregate.totalSaves),
      avgViews: toNumber(aggregate.avgViews),
      avgEngagementRate: aggregate.avgEngagementRate,
      videosLast30d,
      topVideo,
      topCreator,
    };
  }

  private async aggregateMetrics(projectId?: string) {
    const rows = await getPrisma().$queryRaw<
      Array<{
        videoCount: number;
        totalViews: bigint;
        totalLikes: bigint;
        totalComments: bigint;
        totalShares: bigint;
        totalSaves: bigint;
        avgViews: bigint;
        avgEngagementRate: number;
      }>
    >`
      WITH ${latestMetricCte(projectId)}
      SELECT
        COUNT(*)::int AS "videoCount",
        COALESCE(SUM("views"), 0)::bigint AS "totalViews",
        COALESCE(SUM("likes"), 0)::bigint AS "totalLikes",
        COALESCE(SUM("comments"), 0)::bigint AS "totalComments",
        COALESCE(SUM("shares"), 0)::bigint AS "totalShares",
        COALESCE(SUM("saves"), 0)::bigint AS "totalSaves",
        CASE WHEN COUNT(*) > 0
          THEN (COALESCE(SUM("views"), 0) / COUNT(*))::bigint
          ELSE 0::bigint
        END AS "avgViews",
        ROUND(COALESCE(AVG("engagementRate"), 0)::numeric, 4)::float
          AS "avgEngagementRate"
      FROM latest
    `;
    return rows[0];
  }

  private async topVideo(projectId?: string) {
    const rows = await getPrisma().$queryRaw<
      Array<{
        id: string;
        caption: string | null;
        url: string | null;
        views: bigint;
        creatorUsername: string | null;
      }>
    >`
      WITH ${latestMetricCte(projectId)}
      SELECT
        v."id", v."caption", v."url",
        lm."views",
        c."username" AS "creatorUsername"
      FROM latest lm
      JOIN "Video" v ON v."id" = lm."videoId"
      LEFT JOIN "Creator" c ON c."id" = v."creatorId"
      ORDER BY lm."views" DESC NULLS LAST
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      caption: row.caption,
      url: row.url,
      views: toNumber(row.views),
      creatorUsername: row.creatorUsername,
    };
  }

  private async topCreator(projectId?: string) {
    const rows = await getPrisma().$queryRaw<
      Array<{
        id: string;
        username: string;
        profileUrl: string | null;
        followers: number | null;
        videoCount: number;
      }>
    >`
      SELECT
        c."id", c."username", c."profileUrl", c."followers",
        COUNT(v."id")::int AS "videoCount"
      FROM "Creator" c
      JOIN "Video" v ON v."creatorId" = c."id"
        AND v."isSeedData" = FALSE
        AND (${projectId}::text IS NULL OR v."projectId" = ${projectId ?? ""})
      WHERE c."isSeedData" = FALSE
      GROUP BY c."id", c."username", c."profileUrl", c."followers"
      ORDER BY c."followers" DESC NULLS LAST
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      profileUrl: row.profileUrl,
      followers: row.followers,
      videoCount: row.videoCount,
    };
  }

  async engagement(
    projectId: string | undefined,
    from: Date | undefined,
    to: Date | undefined,
    bucket: "day" | "week" | "month" = "day",
  ): Promise<EngagementBucket[]> {
    const rows = await getPrisma().$queryRaw<
      Array<{
        bucket: Date;
        count: number;
        views: bigint;
        likes: bigint;
        comments: bigint;
        shares: bigint;
        avgEngagementRate: number;
      }>
    >`
      WITH ${latestMetricCte(projectId)}
      SELECT
        date_trunc(${bucket}, v."publishedAt") AS "bucket",
        COUNT(*)::int AS "count",
        COALESCE(SUM(lm."views"), 0)::bigint AS "views",
        COALESCE(SUM(lm."likes"), 0)::bigint AS "likes",
        COALESCE(SUM(lm."comments"), 0)::bigint AS "comments",
        COALESCE(SUM(lm."shares"), 0)::bigint AS "shares",
        ROUND(COALESCE(AVG(lm."engagementRate"), 0)::numeric, 4)::float
          AS "avgEngagementRate"
      FROM latest lm
      JOIN "Video" v ON v."id" = lm."videoId"
      WHERE v."publishedAt" IS NOT NULL
        AND (${from}::timestamptz IS NULL OR v."publishedAt" >= ${from})
        AND (${to}::timestamptz IS NULL OR v."publishedAt" < ${to})
      GROUP BY 1
      ORDER BY 1
    `;
    return rows.map((row) => ({
      bucket: row.bucket.toISOString(),
      count: row.count,
      views: toNumber(row.views),
      likes: toNumber(row.likes),
      comments: toNumber(row.comments),
      shares: toNumber(row.shares),
      avgEngagementRate: row.avgEngagementRate,
    }));
  }

  async topCreators(
    projectId: string | undefined,
    sort: "followers" | "engagement" | "views" = "followers",
    limit = 10,
  ): Promise<TopCreator[]> {
    const orderBy =
      sort === "engagement"
        ? `"avgEngagementRate" DESC NULLS LAST`
        : sort === "views"
          ? `"totalViews" DESC NULLS LAST`
          : `c."followers" DESC NULLS LAST`;

    const rows = await getPrisma().$queryRaw<
      Array<{
        id: string;
        externalId: string | null;
        username: string;
        displayName: string | null;
        profileUrl: string | null;
        avatarUrl: string | null;
        followers: number | null;
        videoCount: number;
        totalViews: bigint;
        avgViews: bigint;
        avgEngagementRate: number;
      }>
    >`
      WITH ${latestMetricCte(projectId)}
      SELECT
        c."id", c."externalId", c."username", c."displayName", c."profileUrl", c."avatarUrl",
        c."followers",
        COUNT(v."id")::int AS "videoCount",
        COALESCE(SUM(lm."views"), 0)::bigint AS "totalViews",
        CASE WHEN COUNT(v."id") > 0
          THEN (COALESCE(SUM(lm."views"), 0) / COUNT(v."id"))::bigint
          ELSE 0::bigint
        END AS "avgViews",
        ROUND(COALESCE(AVG(lm."engagementRate"), 0)::numeric, 4)::float
          AS "avgEngagementRate"
      FROM "Creator" c
      JOIN "Video" v ON v."creatorId" = c."id"
        AND v."isSeedData" = FALSE
        AND (${projectId}::text IS NULL OR v."projectId" = ${projectId ?? ""})
      LEFT JOIN latest lm ON lm."videoId" = v."id"
      WHERE c."isSeedData" = FALSE
      GROUP BY c."id", c."externalId", c."username", c."displayName",
               c."profileUrl", c."avatarUrl", c."followers"
      ORDER BY ${Prisma.raw(orderBy)}
      LIMIT ${limit}
    `;
    return rows.map((row) => ({
      ...row,
      totalViews: toNumber(row.totalViews),
      avgViews: toNumber(row.avgViews),
    }));
  }

  async hashtagPerformance(projectId: string | undefined, limit = 10): Promise<HashtagPerformance[]> {
    const rows = await getPrisma().$queryRaw<
      Array<{
        id: string;
        name: string;
        normalizedName: string;
        videoCount: number;
        totalViews: bigint;
        avgEngagementRate: number;
      }>
    >`
      WITH ${latestMetricCte(projectId)}
      SELECT
        h."id", h."name", h."normalizedName",
        COUNT(DISTINCT v."id")::int AS "videoCount",
        COALESCE(SUM(lm."views"), 0)::bigint AS "totalViews",
        ROUND(COALESCE(AVG(lm."engagementRate"), 0)::numeric, 4)::float
          AS "avgEngagementRate"
      FROM "Hashtag" h
      JOIN "VideoHashtag" vh ON vh."hashtagId" = h."id"
      JOIN "Video" v ON v."id" = vh."videoId"
        AND v."isSeedData" = FALSE
        AND (${projectId}::text IS NULL OR v."projectId" = ${projectId ?? ""})
      LEFT JOIN latest lm ON lm."videoId" = v."id"
      WHERE h."isSeedData" = FALSE
      GROUP BY h."id", h."name", h."normalizedName"
      ORDER BY "videoCount" DESC, h."name" ASC
      LIMIT ${limit}
    `;
    return rows.map((row) => ({
      ...row,
      totalViews: toNumber(row.totalViews),
    }));
  }
}

export const analyticsService = new AnalyticsService();