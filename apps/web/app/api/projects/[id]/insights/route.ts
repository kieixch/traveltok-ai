import { route } from "@/lib/server/route";
import { projectInsightsService } from "@/lib/server/services/project-insights.service";

export const GET = route(async ({ user, params }) => {
  return projectInsightsService.insights(user.userId, params.id);
});