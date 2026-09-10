import { getPrisma } from "@/lib/server/prisma";
import { forbidden, notFound } from "@/lib/server/http";
import { buildPagination, paginationParams } from "@/lib/server/utils";
import { Prisma } from "@traveltok/database";

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
  create(input: CreateContentPlanInput) {
    return getPrisma().contentPlan.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status as never ?? "DRAFT",
      },
    });
  }

  async list(page: number, pageSize: number, projectId?: string) {
    const prisma = getPrisma();
    const where = projectId ? { projectId } : {};
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

  async getById(id: string) {
    const plan = await getPrisma().contentPlan.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        items: { orderBy: { scheduledDate: "asc" } },
      },
    });
    if (!plan) {
      throw notFound("Content plan not found");
    }
    return plan;
  }

  async update(id: string, dto: UpdateContentPlanInput) {
    await this.getById(id);
    return getPrisma().contentPlan.update({
      where: { id },
      data: dto as unknown as Prisma.ContentPlanUpdateInput,
    });
  }

  async remove(id: string, userId?: string) {
    await this.assertOwned(id, userId);
    return getPrisma().contentPlan.delete({ where: { id } });
  }

  private async assertOwned(id: string, userId?: string) {
    const plan = await getPrisma().contentPlan.findUnique({
      where: { id },
      include: { project: { select: { createdById: true } } },
    });
    if (!plan) {
      throw notFound("Content plan not found");
    }
    if (userId && plan.project.createdById !== userId) {
      throw forbidden("You do not own this content plan");
    }
    return plan;
  }

  // --- Items ---------------------------------------------------------------

  async createItem(planId: string, dto: CreateContentPlanItemInput) {
    await this.getById(planId);
    const data: Prisma.ContentPlanItemUncheckedCreateInput = {
      contentPlanId: planId,
      title: dto.title ?? "Untitled",
      scheduledDate: dto.scheduledDate ?? new Date(),
      status: (dto.status ?? "IDEA") as never,
    };
    if (dto.contentIdeaId !== undefined) data.contentIdeaId = dto.contentIdeaId;
    return getPrisma().contentPlanItem.create({ data });
  }

  async updateItem(id: string, dto: UpdateContentPlanItemInput) {
    await this.getItemOrThrow(id);
    return getPrisma().contentPlanItem.update({
      where: { id },
      data: dto as unknown as Prisma.ContentPlanItemUpdateInput,
    });
  }

  async removeItem(id: string) {
    await this.getItemOrThrow(id);
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