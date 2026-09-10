import { route } from "@/lib/server/route";
import { projectsService } from "@/lib/server/services/projects.service";

export const GET = route(async ({ user, params }) => {
  return projectsService.getById(user.userId, params.id);
});

export const PATCH = route(async ({ user, params, body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  return projectsService.update(user.userId, params.id, {
    ...(dto.name !== undefined ? { name: String(dto.name) } : {}),
    ...(dto.description !== undefined && dto.description !== null
      ? { description: String(dto.description) }
      : {}),
    ...(dto.niche !== undefined && dto.niche !== null
      ? { niche: String(dto.niche) }
      : {}),
  });
});

export const DELETE = route(async ({ user, params }) => {
  return projectsService.remove(user.userId, params.id);
});