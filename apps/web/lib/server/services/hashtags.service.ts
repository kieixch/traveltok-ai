import { Prisma } from "@traveltok/database";
import { getPrisma } from "@/lib/server/prisma";
import { notFound } from "@/lib/server/http";
import { requireOwnedProject } from "@/lib/server/authz";

export interface TopHashtag {
  id: string;
  name: string;
  normalizedName: string;
  usage: number;
}

class HashtagsService {
  async top(projectId: string | undefined, limit: number, userId: string): Promise<TopHashtag[]> {
    let projectClause: Prisma.Sql;
    if (projectId) {
      await requireOwnedProject(userId, projectId);
      projectClause = Prisma.sql`AND v."projectId" = ${projectId}`;
    } else {
      projectClause = Prisma.sql`AND v."projectId" IN (SELECT p."id" FROM "Project" p WHERE p."createdById" = ${userId})`;
    }
    const rows = await getPrisma().$queryRaw<
      Array<{
        id: string;
        name: string;
        normalizedName: string;
        usage: number;
      }>
    >`
      SELECT h."id", h."name", h."normalizedName", COUNT(vh."hashtagId")::int AS "usage"
      FROM "Hashtag" h
      JOIN "VideoHashtag" vh ON vh."hashtagId" = h."id"
      JOIN "Video" v ON v."id" = vh."videoId"
      WHERE 1 = 1 ${projectClause}
      GROUP BY h."id", h."name", h."normalizedName"
      ORDER BY "usage" DESC, h."name" ASC
      LIMIT ${limit}
    `;
    return rows;
  }

  async getById(id: string, userId: string) {
    const hashtag = await getPrisma().hashtag.findFirst({
      where: {
        id,
        videos: { some: { video: { project: { createdById: userId } } } },
      },
      include: {
        videos: {
          where: { video: { project: { createdById: userId } } },
          orderBy: { video: { publishedAt: "desc" } },
          take: 20,
          include: {
            video: {
              include: {
                creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
              },
            },
          },
        },
      },
    });
    if (!hashtag) {
      throw notFound("Hashtag not found");
    }
    return hashtag;
  }
}

export const hashtagsService = new HashtagsService();