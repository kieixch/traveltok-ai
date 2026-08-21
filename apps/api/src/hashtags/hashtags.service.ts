import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@traveltok/database";

export interface TopHashtag {
  id: string;
  name: string;
  normalizedName: string;
  usage: number;
}

@Injectable()
export class HashtagsService {
  constructor(private readonly prisma: PrismaService) {}

  async top(projectId: string | undefined, limit: number): Promise<TopHashtag[]> {
    const rows = await this.prisma.$queryRaw<
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
    const hashtag = await this.prisma.hashtag.findUnique({
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
      throw new NotFoundException("Hashtag not found");
    }
    return hashtag;
  }
}
