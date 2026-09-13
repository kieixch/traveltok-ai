import { route } from "@/lib/server/route";
import { pageParams } from "@/lib/server/utils";
import { aiAnalysisService } from "@/lib/server/services/ai-analysis.service";

export const GET = route(async ({ user, params, query }) => {
  const { page, pageSize } = pageParams(query);
  return aiAnalysisService.listAnalyses(user.userId, params.id, page, pageSize);
});