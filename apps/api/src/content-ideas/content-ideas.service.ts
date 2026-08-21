import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ContentIdeaStatus, PrismaService } from "@traveltok/database";
import { buildPagination, paginationParams } from "../common/utils/pagination";
import { CreateContentIdeaDto } from "./dto/create-content-idea.dto";
import { UpdateContentIdeaDto } from "./dto/update-content-idea.dto";

@Injectable()
export class ContentIdeasService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateContentIdeaDto) {
    return this.prisma.contentIdea.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        topic: dto.topic,
        destination: dto.destination,
        format: dto.format,
        hook: dto.hook,
        concept: dto.concept,
        targetAudience: dto.targetAudience,
        cta: dto.cta,
        estimatedDuration: dto.estimatedDuration,
        opportunityScore: dto.opportunityScore,
        aiReasoning: dto.aiReasoning,
        status: dto.status ?? "IDEA",
      },
    });
  }

  async list(
    page: number,
    pageSize: number,
    filters: { projectId?: string; status?: ContentIdeaStatus },
  ) {
    const where = {
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contentIdea.findMany({
        where,
        ...paginationParams(page, pageSize),
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.contentIdea.count({ where }),
    ]);
    return buildPagination(items, total, page, pageSize);
  }

  async getById(id: string) {
    const idea = await this.prisma.contentIdea.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        planItems: { select: { id: true, contentPlanId: true, status: true } },
      },
    });
    if (!idea) {
      throw new NotFoundException("Content idea not found");
    }
    return idea;
  }

  async update(id: string, dto: UpdateContentIdeaDto) {
    await this.getById(id);
    return this.prisma.contentIdea.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId?: string) {
    await this.assertOwned(id, userId);
    return this.prisma.contentIdea.delete({ where: { id } });
  }

  private async assertOwned(id: string, userId?: string) {
    const idea = await this.prisma.contentIdea.findUnique({
      where: { id },
      include: { project: { select: { createdById: true } } },
    });
    if (!idea) {
      throw new NotFoundException("Content idea not found");
    }
    if (userId && idea.project.createdById !== userId) {
      throw new ForbiddenException("You do not own this content idea");
    }
    return idea;
  }
}
