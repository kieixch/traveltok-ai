import { route } from "@/lib/server/route";
import { contentPlansService } from "@/lib/server/services/content-plans.service";

export const GET = route(async ({ params }) => {
  return contentPlansService.getById(params.id);
});

export const PATCH = route(async ({ params, body }) => {
  return contentPlansService.update(params.id, (body ?? {}) as Record<string, unknown>);
});

export const DELETE = route(async ({ user, params }) => {
  return contentPlansService.remove(params.id, user.userId);
});