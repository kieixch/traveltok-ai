import { route } from "@/lib/server/route";
import { contentIdeasService } from "@/lib/server/services/content-ideas.service";

export const GET = route(async ({ params }) => {
  return contentIdeasService.getById(params.id);
});

export const PATCH = route(async ({ params, body }) => {
  return contentIdeasService.update(params.id, (body ?? {}) as Record<string, unknown>);
});

export const DELETE = route(async ({ user, params }) => {
  return contentIdeasService.remove(params.id, user.userId);
});