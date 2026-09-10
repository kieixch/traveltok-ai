import { route } from "@/lib/server/route";
import { contentPlansService } from "@/lib/server/services/content-plans.service";

export const POST = route(async ({ params, body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  return contentPlansService.createItem(params.id, dto);
});