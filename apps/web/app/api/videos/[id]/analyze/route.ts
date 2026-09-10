import { route } from "@/lib/server/route";
import { aiAnalysisService } from "@/lib/server/services/ai-analysis.service";

export const POST = route(async ({ user, params }) => {
  return aiAnalysisService.analyzeVideo(user.userId, params.id);
});