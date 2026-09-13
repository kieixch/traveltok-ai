import { route } from "@/lib/server/route";
import { creatorsService } from "@/lib/server/services/creators.service";
import { pageParams } from "@/lib/server/utils";

export const GET = route(async ({ user, query }) => {
  const { page, pageSize, order } = pageParams(query);
  const min = (name: string): number | undefined => {
    const raw = query.get(name);
    if (raw === null || raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  return creatorsService.list(page, pageSize, query.get("sort") ?? "followers", order, {
    search: query.get("search") ?? undefined,
    projectId: query.get("projectId") ?? undefined,
    minFollowers: min("minFollowers"),
    minViews: min("minViews"),
    minEngagement: min("minEngagement"),
  }, user.userId);
});