import { getPrisma } from "@/lib/server/prisma";
import { forbidden, notFound } from "@/lib/server/http";
import { buildPagination, paginationParams } from "@/lib/server/utils";
import { Prisma, type ContentIdeaStatus } from "@traveltok/database";

export interface CreateContentIdeaInput {
  projectId: string;
  title: string;
  topic?: string | null;
  destination?: string | null;
  format?: string | null;
  hook?: string | null;
  concept?: string | null;
  targetAudience?: string | null;
  cta?: string | null;
  estimatedDuration?: number | null;
  opportunityScore?: number | null;
  aiReasoning?: string | null;
  status?: ContentIdeaStatus;
}

export type UpdateContentIdeaInput = Partial<CreateContentIdeaInput>;

class ContentIdeasService {
  create(input: CreateContentIdeaInput) {
    return getPrisma().contentIdea.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        topic: input.topic,
        destination: input.destination,
        format: input.format as never,
        hook: input.hook,
        concept: input.concept,
        targetAudience: input.targetAudience,
        cta: input.cta,
        estimatedDuration: input.estimatedDuration,
        opportunityScore: input.opportunityScore,
        aiReasoning: input.aiReasoning,
        status: input.status ?? "IDEA",
      },
    });
  }

  async list(
    page: number,
    pageSize: number,
    filters: { projectId?: string; status?: ContentIdeaStatus },
  ) {
    const prisma = getPrisma();
    const where = {
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.contentIdea.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { createdAt: "desc" },
      }),
      prisma.contentIdea.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }

  async getById(id: string) {
    const idea = await getPrisma().contentIdea.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        planItems: { select: { id: true, contentPlanId: true, status: true } },
      },
    });
    if (!idea) {
      throw notFound("Content idea not found");
    }
    return idea;
  }

  async update(id: string, dto: UpdateContentIdeaInput) {
    await this.getById(id);
    return getPrisma().contentIdea.update({
      where: { id },
      data: dto as unknown as Prisma.ContentIdeaUpdateInput,
    });
  }

  async remove(id: string, userId?: string) {
    await this.assertOwned(id, userId);
    return getPrisma().contentIdea.delete({ where: { id } });
  }

  private async assertOwned(id: string, userId?: string) {
    const idea = await getPrisma().contentIdea.findUnique({
      where: { id },
      include: { project: { select: { createdById: true } } },
    });
    if (!idea) {
      throw notFound("Content idea not found");
    }
    if (userId && idea.project.createdById !== userId) {
      throw forbidden("You do not own this content idea");
    }
    return idea;
  }
}

export const contentIdeasService = new ContentIdeasService();