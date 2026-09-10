import { route } from "@/lib/server/route";
import { contentGenerationService } from "@/lib/server/services/content-generation.service";

export const POST = route(async ({ user, params, body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  return contentGenerationService.generateCaption(user.userId, params.id, {
    language: dto.language !== undefined ? String(dto.language) : undefined,
  });
});