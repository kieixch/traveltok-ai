import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@traveltok/database";
import { buildPagination, paginationParams } from "../common/utils/pagination";
import { CreateContentPlanDto } from "./dto/create-content-plan.dto";
import { UpdateContentPlanDto } from "./dto/update-content-plan.dto";
import { CreateContentPlanItemDto } from "./dto/create-content-plan-item.dto";
import { UpdateContentPlanItemDto } from "./dto/update-content-plan-item.dto";

@Injectable()
export class ContentPlansService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateContentPlanDto) {
    return this.prisma.contentPlan.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        startDate: dto.startDate,
        endDate: dto.endDate,
        status: dto.status ?? "DRAFT",
      },
    });
  }

  async list(page: number, pageSize: number, projectId?: string) {
    const where = projectId ? { projectId } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contentPlan.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { startDate: "desc" },
        include: { _count: { select: { items: true } } },
      }),
      this.prisma.contentPlan.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }

  async getById(id: string) {
    const plan = await this.prisma.contentPlan.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        items: { orderBy: { scheduledDate: "asc" } },
      },
    });
    if (!plan) {
      throw new NotFoundException("Content plan not found");
    }
    return plan;
  }

  async update(id: string, dto: UpdateContentPlanDto) {
    await this.getById(id);
    return this.prisma.contentPlan.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId?: string) {
    await this.assertOwned(id, userId);
    return this.prisma.contentPlan.delete({ where: { id } });
  }

  private async assertOwned(id: string, userId?: string) {
    const plan = await this.prisma.contentPlan.findUnique({
      where: { id },
      include: { project: { select: { createdById: true } } },
    });
    if (!plan) {
      throw new NotFoundException("Content plan not found");
    }
    if (userId && plan.project.createdById !== userId) {
      throw new ForbiddenException("You do not own this content plan");
    }
    return plan;
  }

  // --- Items ---------------------------------------------------------------

  async createItem(planId: string, dto: CreateContentPlanItemDto) {
    await this.getById(planId);
    return this.prisma.contentPlanItem.create({
      data: {
        ...dto,
        contentPlanId: planId,
        status: dto.status ?? "IDEA",
      },
    });
  }

  async updateItem(id: string, dto: UpdateContentPlanItemDto) {
    await this.getItemOrThrow(id);
    return this.prisma.contentPlanItem.update({ where: { id }, data: dto });
  }

  async removeItem(id: string) {
    await this.getItemOrThrow(id);
    return this.prisma.contentPlanItem.delete({ where: { id } });
  }

  private async getItemOrThrow(id: string) {
    const item = await this.prisma.contentPlanItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException("Content plan item not found");
    }
    return item;
  }
}
