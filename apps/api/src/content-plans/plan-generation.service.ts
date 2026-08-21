import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, PrismaService } from "@traveltok/database";
import {
  AIConfig,
  ContentPlannerInput,
  createContentPlanner,
  PlannerIdea,
} from "@traveltok/ai";
import { AI_CONFIG } from "../ai/ai.constants";
import { AiRuntimeService } from "../ai/ai-runtime.service";
import { GenerateContentPlanDto } from "./dto/generate-content-plan.dto";

@Injectable()
export class PlanGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_CONFIG) private readonly config: AIConfig,
    private readonly runtime: AiRuntimeService,
  ) {}

  async generate(userId: string, dto: GenerateContentPlanDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, name: true, niche: true },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException("endDate must not be before startDate");
    }

    const ideas = await this.prisma.contentIdea.findMany({
      where: { projectId: project.id, status: { not: "ARCHIVED" } },
      orderBy: [{ opportunityScore: "desc" }, { createdAt: "desc" }],
      take: 30,
    });
    if (ideas.length === 0) {
      throw new BadRequestException(
        "No content ideas to schedule — generate ideas first",
      );
    }

    const postsPerWeek = dto.postsPerWeek ?? 3;
    const plannerIdeas: PlannerIdea[] = ideas.map((idea) => ({
      id: idea.id,
      title: idea.title,
      format: idea.format,
      opportunityScore: idea.opportunityScore,
    }));

    const input: ContentPlannerInput = {
      projectName: project.name,
      niche: project.niche,
      startDate: dto.startDate,
      endDate: dto.endDate,
      postsPerWeek,
      ideas: plannerIdeas,
      randomness: `${project.id}:${dto.startDate.toISOString()}:${postsPerWeek}`,
      language: dto.language,
    };

    const mode = await this.runtime.modeFor(userId);
    const model = await this.runtime.modelFor(userId, mode);
    const planner = createContentPlanner(this.config, mode, model);
    const draft = await planner.generate(input);
    const label = mode === "mock" ? "mock-content-planner" : model;

    return this.persistPlan(project.id, dto, draft.title, draft.description ?? null, draft.items, label);
  }

  private async persistPlan(
    projectId: string,
    dto: GenerateContentPlanDto,
    title: string,
    description: string | null,
    items: Array<{ contentIdeaId: string; scheduledDate: string; title: string }>,
    model: string,
  ) {
    const ideaMap = new Map(
      (await this.prisma.contentIdea.findMany({
        where: { projectId },
        select: { id: true, hook: true, script: true, caption: true, hashtags: true, cta: true, format: true },
      })).map((idea) => [idea.id, idea]),
    );

    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.contentPlan.create({
        data: {
          projectId,
          title: dto.title ?? title,
          description,
          startDate: dto.startDate,
          endDate: dto.endDate,
          status: dto.status ?? "DRAFT",
          generatedBy: "AI",
          aiModel: model,
          rawJson: {
            title,
            description,
            items,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      if (items.length > 0) {
        await tx.contentPlanItem.createMany({
          data: items.map((item) => {
            const idea = ideaMap.get(item.contentIdeaId);
            return {
              contentPlanId: plan.id,
              contentIdeaId: item.contentIdeaId,
              scheduledDate: new Date(`${item.scheduledDate}T00:00:00.000Z`),
              title: item.title,
              hook: idea?.hook ?? null,
              script: idea?.script ?? null,
              caption: idea?.caption ?? null,
              hashtags: idea?.hashtags ? idea.hashtags.join(", ") : null,
              cta: idea?.cta ?? null,
              format: idea?.format ?? null,
              status: "SCHEDULED",
              generatedBy: "AI",
            };
          }),
        });
      }

      return tx.contentPlan.findUnique({
        where: { id: plan.id },
        include: { items: { orderBy: { scheduledDate: "asc" } } },
      });
    });
  }
}
