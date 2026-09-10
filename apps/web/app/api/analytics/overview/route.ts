import { route } from "@/lib/server/route";
import { analyticsService } from "@/lib/server/services/analytics.service";

export const GET = route(async ({ query }) => {
  return analyticsService.overview(query.get("projectId") ?? undefined);
});