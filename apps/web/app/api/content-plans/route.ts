import { route } from "@/lib/server/route";
import { contentPlansService } from "@/lib/server/services/content-plans.service";
import { pageParams } from "@/lib/server/utils";

export const GET = route(async ({ query }) => {
  const { page, pageSize } = pageParams(query);
  return contentPlansService.list(page, pageSize, query.get("projectId") ?? undefined);
});