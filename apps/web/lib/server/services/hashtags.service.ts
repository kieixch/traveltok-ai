import { getPrisma } from "@/lib/server/prisma";
import { notFound } from "@/lib/server/http";

export interface TopHashtag {
  id: string;
  name: string;
  normalizedName: string;
  usage: number;
}

class HashtagsService {
  async top(projectId: string | undefined, limit: number): Promise<TopHashtag[]> {
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
      WHERE (${projectId}::text IS NULL OR v."projectId" = ${projectId})
      GROUP BY h."id", h."name", h."normalizedName"
      ORDER BY "usage" DESC, h."name" ASC
      LIMIT ${limit}
    `;
    return rows;
  }

  async getById(id: string) {
    const hashtag = await getPrisma().hashtag.findUnique({
      where: { id },
      include: {
        videos: {
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