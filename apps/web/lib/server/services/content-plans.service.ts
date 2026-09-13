import { getPrisma } from "@/lib/server/prisma";
import { notFound } from "@/lib/server/http";
import { buildPagination, paginationParams } from "@/lib/server/utils";
import { Prisma } from "@traveltok/database";
import { ownedProjectWhere, requireOwnedProject } from "@/lib/server/authz";

export interface CreateContentPlanInput {
  projectId: string;
  title: string;
  description?: string | null;
  startDate: Date;
  endDate: Date;
  status?: string;
}

export type UpdateContentPlanInput = Partial<CreateContentPlanInput>;

export interface CreateContentPlanItemInput {
  contentIdeaId?: string | null;
  title?: string;
  scheduledDate?: Date;
  status?: string;
}

export type UpdateContentPlanItemInput = Partial<CreateContentPlanItemInput>;

class ContentPlansService {
  async create(input: CreateContentPlanInput, userId: string) {
    const projectId = await requireOwnedProject(userId, input.projectId);
    return getPrisma().contentPlan.create({
      data: {
        projectId,
        title: input.title,
        description: input.description,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status as never ?? "DRAFT",
      },
    });
  }

  async list(page: number, pageSize: number, projectId: string | undefined, userId: string) {
    const prisma = getPrisma();
    const where = projectId
      ? { projectId: await requireOwnedProject(userId, projectId) }
      : ownedProjectWhere(userId);
    const [items, total] = await prisma.$transaction([
      prisma.contentPlan.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { startDate: "desc" },
        include: { _count: { select: { items: true } } },
      }),
      prisma.contentPlan.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }

  async getById(id: string, userId: string) {
    const plan = await getPrisma().contentPlan.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, createdById: true } },
        items: { orderBy: { scheduledDate: "asc" } },
      },
    });
    if (!plan || plan.project.createdById !== userId) {
      throw notFound("Content plan not found");
    }
    return plan;
  }

  async update(id: string, dto: UpdateContentPlanInput, userId: string) {
    await this.getById(id, userId);
    return getPrisma().contentPlan.update({
      where: { id },
      data: dto as unknown as Prisma.ContentPlanUpdateInput,
    });
  }

  async remove(id: string, userId: string) {
    await this.assertOwned(id, userId);
    return getPrisma().contentPlan.delete({ where: { id } });
  }

  private async assertOwned(id: string, userId: string) {
    const plan = await getPrisma().contentPlan.findUnique({
      where: { id },
      include: { project: { select: { createdById: true } } },
    });
    if (!plan) {
      throw notFound("Content plan not found");
    }
    if (plan.project.createdById !== userId) {
      throw notFound("Content plan not found");
    }
    return plan;
  }

  // --- Items ---------------------------------------------------------------

  async createItem(planId: string, dto: CreateContentPlanItemInput, userId: string) {
    await this.assertOwned(planId, userId);
    const data: Prisma.ContentPlanItemUncheckedCreateInput = {
      contentPlanId: planId,
      title: dto.title ?? "Untitled",
      scheduledDate: dto.scheduledDate ?? new Date(),
      status: (dto.status ?? "IDEA") as never,
    };
    if (dto.contentIdeaId !== undefined) data.contentIdeaId = dto.contentIdeaId;
    return getPrisma().contentPlanItem.create({ data });
  }

  async updateItem(id: string, dto: UpdateContentPlanItemInput, userId: string) {
    const item = await this.getItemOrThrow(id);
    await this.assertOwned(item.contentPlanId, userId);
    return getPrisma().contentPlanItem.update({
      where: { id },
      data: dto as unknown as Prisma.ContentPlanItemUpdateInput,
    });
  }

  async removeItem(id: string, userId: string) {
    const item = await this.getItemOrThrow(id);
    await this.assertOwned(item.contentPlanId, userId);
    return getPrisma().contentPlanItem.delete({ where: { id } });
  }

  private async getItemOrThrow(id: string) {
    const item = await getPrisma().contentPlanItem.findUnique({ where: { id } });
    if (!item) {
      throw notFound("Content plan item not found");
    }
    return item;
  }
}

export const contentPlansService = new ContentPlansService();