import { route } from "@/lib/server/route";
import { contentPlansService } from "@/lib/server/services/content-plans.service";

export const PATCH = route(async ({ params, body }) => {
  return contentPlansService.updateItem(params.itemId, (body ?? {}) as Record<string, unknown>);
});

export const DELETE = route(async ({ params }) => {
  return contentPlansService.removeItem(params.itemId);
});