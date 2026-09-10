import { route } from "@/lib/server/route";
import { contentGenerationService } from "@/lib/server/services/content-generation.service";

export const POST = route(async ({ user, body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  return contentGenerationService.generateIdeas(user.userId, {
    projectId: String(dto.projectId),
    count: dto.count !== undefined ? Number(dto.count) : undefined,
    format: dto.format as never | undefined,
    language: dto.language !== undefined ? String(dto.language) : undefined,
  });
});