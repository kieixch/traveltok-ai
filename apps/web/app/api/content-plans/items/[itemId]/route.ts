import { route } from "@/lib/server/route";
import { contentPlansService } from "@/lib/server/services/content-plans.service";

export const PATCH = route(async ({ user, params, body }) => {
  return contentPlansService.updateItem(params.itemId, (body ?? {}) as Record<string, unknown>, user.userId);
});

export const DELETE = route(async ({ user, params }) => {
  return contentPlansService.removeItem(params.itemId, user.userId);
});