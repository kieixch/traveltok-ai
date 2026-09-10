import { route } from "@/lib/server/route";
import { analyticsService } from "@/lib/server/services/analytics.service";

const SORTS = ["followers", "engagement", "views"] as const;

export const GET = route(async ({ query }) => {
  const sortRaw = query.get("sort");
  const sort = SORTS.includes(sortRaw as never)
    ? (sortRaw as "followers" | "engagement" | "views")
    : "followers";
  const limit = Math.min(100, Math.max(1, Number(query.get("limit") ?? 10) || 10));
  return analyticsService.topCreators(
    query.get("projectId") ?? undefined,
    sort,
    limit,
  );
});