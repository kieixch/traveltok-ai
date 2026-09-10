import { route } from "@/lib/server/route";
import { hashtagsService } from "@/lib/server/services/hashtags.service";

export const GET = route(async ({ query }) => {
  const top = Math.min(100, Math.max(1, Number(query.get("top") ?? 20) || 20));
  return hashtagsService.top(query.get("projectId") ?? undefined, top);
});