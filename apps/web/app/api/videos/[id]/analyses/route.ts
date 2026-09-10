import { route } from "@/lib/server/route";
import { pageParams } from "@/lib/server/utils";
import { aiAnalysisService } from "@/lib/server/services/ai-analysis.service";

export const GET = route(async ({ params, query }) => {
  const { page, pageSize } = pageParams(query);
  return aiAnalysisService.listAnalyses(params.id, page, pageSize);
});