import { getPrisma } from "@/lib/server/prisma";
import { badRequest, notFound } from "@/lib/server/http";
import { buildPagination, paginationParams } from "@/lib/server/utils";
import { scrapingJobsService } from "./scraping-jobs.service";

export interface CreateProjectInput {
  name: string;
  description?: string;
  niche?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  niche?: string;
}

export interface ScrapeProjectInput {
  keyword?: string;
  hashtag?: string;
  maxResults?: number;
}

export class ProjectsService {
  async create(userId: string, input: CreateProjectInput) {
    const prisma = getPrisma();
    return prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        niche: input.niche,
        createdById: userId,
      },
    });
  }

  async list(userId: string, page: number, pageSize: number, search?: string) {
    const prisma = getPrisma();
    const where = {
      createdById: userId,
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { createdAt: "desc" },
      }),
      prisma.project.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }

  async getById(userId: string, id: string) {
    return this.findOwnedOrThrow(userId, id);
  }

  async update(userId: string, id: string, input: UpdateProjectInput) {
    const prisma = getPrisma();
    await this.findOwnedOrThrow(userId, id);
    return prisma.project.update({ where: { id }, data: input });
  }

  async remove(userId: string, id: string) {
    const prisma = getPrisma();
    await this.findOwnedOrThrow(userId, id);
    return prisma.project.delete({ where: { id } });
  }

  /** Creates a scraping job for a project (mock = sync, apify = webhook). */
  async scrape(userId: string, projectId: string, input: ScrapeProjectInput) {
    const project = await this.findOwnedOrThrow(userId, projectId);

    const keyword = input.keyword?.trim() || undefined;
    const hashtag = input.hashtag?.trim() || undefined;

    const resolvedHashtag =
      hashtag ?? (keyword ? undefined : this.nicheToHashtag(project.niche));
    const resolvedKeyword = keyword;

    if (!resolvedHashtag && !resolvedKeyword) {
      throw badRequest(
        "Provide a keyword or hashtag (or set the project niche) to scrape",
      );
    }

    return scrapingJobsService.create(
      {
        projectId,
        keyword: resolvedKeyword,
        hashtag: resolvedHashtag,
        maxResults: input.maxResults,
      },
      userId,
    );
  }

  private nicheToHashtag(niche: string | null | undefined): string | undefined {
    if (!niche) return undefined;
    const slug = niche.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return slug.slice(0, 40) || undefined;
  }

  private async findOwnedOrThrow(userId: string, id: string) {
    const project = await getPrisma().project.findFirst({
      where: { id, createdById: userId },
    });
    if (!project) {
      throw notFound("Project not found");
    }
    return project;
  }
}

export const projectsService = new ProjectsService();