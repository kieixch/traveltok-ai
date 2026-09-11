import { route } from "@/lib/server/route";
import { contentGenerationService } from "@/lib/server/services/content-generation.service";

export const POST = route(async ({ user, body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  return contentGenerationService.generateIdeasFromVideos(user.userId, {
    projectId: String(dto.projectId),
    videoIds: Array.isArray(dto.videoIds)
      ? (dto.videoIds as string[])
      : undefined,
    count: dto.count !== undefined ? Number(dto.count) : undefined,
    language: dto.language !== undefined ? String(dto.language) : undefined,
  });
});