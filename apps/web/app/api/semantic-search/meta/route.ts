import { route } from "@/lib/server/route";
import { semanticSearchService } from "@/lib/server/services/semantic-search.service";

export const GET = route(async ({ user, query }) => {
  const projectId = query.get("projectId");
  if (!projectId) {
    return { indexed: false, videos: 0, ideas: 0, trends: 0, total: 0, model: null };
  }
  return semanticSearchService.meta(user.userId, projectId);
});