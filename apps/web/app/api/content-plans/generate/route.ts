import { route } from "@/lib/server/route";
import { planGenerationService } from "@/lib/server/services/plan-generation.service";

export const POST = route(async ({ user, body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  return planGenerationService.generate(user.userId, {
    projectId: String(dto.projectId),
    startDate: new Date(String(dto.startDate)),
    endDate: new Date(String(dto.endDate)),
    postsPerWeek: dto.postsPerWeek !== undefined ? Number(dto.postsPerWeek) : undefined,
    title: dto.title !== undefined ? String(dto.title) : undefined,
    status: dto.status !== undefined ? String(dto.status) : undefined,
    language: dto.language !== undefined ? String(dto.language) : undefined,
  });
});