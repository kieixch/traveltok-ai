import { Prisma } from "@traveltok/database";
import {
  createContentPlanner,
  type AIConfig,
  type ContentPlannerInput,
  type PlannerIdea,
} from "@traveltok/ai";
import { getPrisma } from "@/lib/server/prisma";
import { badRequest, notFound } from "@/lib/server/http";
import { getAIConfig } from "@/lib/server/ai";
import { aiRuntimeService } from "./ai-runtime.service";

export interface GenerateContentPlanInput {
  projectId: string;
  startDate: Date;
  endDate: Date;
  postsPerWeek?: number;
  title?: string;
  status?: string;
  language?: string;
}

class PlanGenerationService {
  private readonly config: AIConfig;

  constructor() {
    this.config = getAIConfig();
  }

  async generate(userId: string, dto: GenerateContentPlanInput) {
    const project = await getPrisma().project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, name: true, niche: true },
    });
    if (!project) {
      throw notFound("Project not found");
    }
    if (dto.endDate < dto.startDate) {
      throw badRequest("endDate must not be before startDate");
    }

    const ideas = await getPrisma().contentIdea.findMany({
      where: { projectId: project.id, status: { not: "ARCHIVED" } },
      orderBy: [{ opportunityScore: "desc" }, { createdAt: "desc" }],
      take: 30,
    });
    if (ideas.length === 0) {
      throw badRequest(
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

    const mode = await aiRuntimeService.modeFor(userId);
    const model = await aiRuntimeService.modelFor(userId, mode);
    const planner = createContentPlanner(this.config, mode, model);
    const draft = await planner.generate(input);
    const label = mode === "mock" ? "mock-content-planner" : model;

    return this.persistPlan(project.id, dto, draft.title, draft.description ?? null, draft.items, label);
  }

  private async persistPlan(
    projectId: string,
    dto: GenerateContentPlanInput,
    title: string,
    description: string | null,
    items: Array<{ contentIdeaId: string; scheduledDate: string; title: string }>,
    model: string,
  ) {
    const prisma = getPrisma();
    const ideaMap = new Map(
      (await prisma.contentIdea.findMany({
        where: { projectId },
        select: { id: true, hook: true, script: true, caption: true, hashtags: true, cta: true, format: true },
      })).map((idea) => [idea.id, idea]),
    );

    return prisma.$transaction(async (tx) => {
      const plan = await tx.contentPlan.create({
        data: {
          projectId,
          title: dto.title ?? title,
          description,
          startDate: dto.startDate,
          endDate: dto.endDate,
          status: (dto.status ?? "DRAFT") as never,
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

export const planGenerationService = new PlanGenerationService();