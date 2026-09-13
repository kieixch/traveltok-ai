import { route } from "@/lib/server/route";
import { contentPlansService } from "@/lib/server/services/content-plans.service";

export const GET = route(async ({ user, params }) => {
  return contentPlansService.getById(params.id, user.userId);
});

export const PATCH = route(async ({ user, params, body }) => {
  return contentPlansService.update(params.id, (body ?? {}) as Record<string, unknown>, user.userId);
});

export const DELETE = route(async ({ user, params }) => {
  return contentPlansService.remove(params.id, user.userId);
});