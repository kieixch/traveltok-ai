import { route } from "@/lib/server/route";
import { videosService } from "@/lib/server/services/videos.service";
import { pageParams } from "@/lib/server/utils";

export const GET = route(async ({ user, query }) => {
  const { page, pageSize, order } = pageParams(query);
  const sort = query.get("sort") ?? "scrapedAt";
  return videosService.list(page, pageSize, sort, order, {
    projectId: query.get("projectId") ?? undefined,
    search: query.get("search") ?? undefined,
  }, user.userId);
});