import { route } from "@/lib/server/route";
import { analyticsService } from "@/lib/server/services/analytics.service";

export const GET = route(async ({ query }) => {
  const limit = Math.min(100, Math.max(1, Number(query.get("limit") ?? 10) || 10));
  return analyticsService.hashtagPerformance(
    query.get("projectId") ?? undefined,
    limit,
  );
});