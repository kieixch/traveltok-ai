import { route } from "@/lib/server/route";
import { trendsService } from "@/lib/server/services/trends.service";
import { pageParams } from "@/lib/server/utils";

export const GET = route(async ({ user, query }) => {
  const { page, pageSize } = pageParams(query);
  const fromRaw = query.get("from");
  return trendsService.list(page, pageSize, {
    projectId: query.get("projectId") ?? undefined,
    type: query.get("type") as never,
    from: fromRaw && !Number.isNaN(Date.parse(fromRaw)) ? new Date(fromRaw) : undefined,
  }, user.userId);
});